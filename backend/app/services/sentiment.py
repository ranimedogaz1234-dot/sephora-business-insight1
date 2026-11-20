"""Sentiment analytics over stored labels (read-only; nothing here calls an AI service).

Labels are aligned to the review rows once per store version and cached in memory, so every
endpoint is a vectorised count over the same review filters as the rest of the API.
Only classified reviews are counted; coverage is always reported next to the results.
"""

from __future__ import annotations

import hashlib
import logging
import threading
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

from app.data.dataset import Dataset
from app.schemas.queries import ReviewFilters, SentimentBreakdownQuery, TrendQuery
from app.schemas.responses import (
    Evidence,
    LabelShare,
    NamedCount,
    SentimentBreakdown,
    SentimentGroup,
    SentimentInsight,
    SentimentInsights,
    SentimentRun,
    SentimentSummary,
    SentimentTrend,
    SentimentTrendPoint,
    StoredInsights,
)
from app.sentiment import LABELS
from app.sentiment.store import SOURCES, SentimentStore
from app.services.common import r4, review_mask
from app.services.reviews import period_keys, period_label

# Groups (brands, subcategories, products, years) need at least this many classified
# reviews before a computed insight compares them.
INSIGHT_MIN_CLASSIFIED = 50

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Aligned:
    label: np.ndarray  # int8 per review row: -1 unclassified, else index into LABELS
    source: np.ndarray  # int8 per review row: -1 unclassified, else index into SOURCES
    models: tuple[str, ...]
    prompt_versions: tuple[str, ...]


_lock = threading.Lock()
_aligned: dict[tuple, Aligned] = {}


def _dataset_fingerprint(ds: Dataset) -> str:
    """Cheap identity of the review rows: count plus a sample of ids from across the table."""
    ids = ds.reviews["review_id"]
    n = len(ids)
    sample = (
        [str(ids.iloc[i]) for i in np.linspace(0, n - 1, num=min(n, 64), dtype=int)] if n else []
    )
    return hashlib.sha256(f"{n}|{'|'.join(sample)}".encode()).hexdigest()


def _sidecar(store: SentimentStore) -> Path:
    return store.path.with_name(store.path.name + ".aligned.npz")


def _load_sidecar(store: SentimentStore, key: str) -> Aligned | None:
    path = _sidecar(store)
    if not path.exists():
        return None
    try:
        with np.load(path, allow_pickle=False) as z:
            if str(z["key"]) != key:
                return None
            return Aligned(
                z["label"], z["source"], tuple(z["models"].tolist()), tuple(z["versions"].tolist())
            )
    except (OSError, ValueError, KeyError):
        return None  # unreadable or old format: rebuild


def _save_sidecar(store: SentimentStore, key: str, a: Aligned) -> None:
    path = _sidecar(store)
    tmp = path.with_name(path.name + ".tmp.npz")
    try:
        np.savez(
            tmp,
            key=np.array(key),
            label=a.label,
            source=a.source,
            models=np.array(a.models, dtype=str),
            versions=np.array(a.prompt_versions, dtype=str),
        )
        tmp.replace(path)
    except OSError:
        log.warning("Could not write the sentiment alignment cache; continuing without it.")


def aligned_labels(ds: Dataset, store: SentimentStore) -> Aligned:
    """Labels aligned to review rows: in memory per store version, and persisted beside the
    store (keyed by store version + dataset fingerprint) so a restart does not re-read it."""
    version = store.version()
    key = (id(ds), str(store.path), version)
    with _lock:
        if key in _aligned:
            return _aligned[key]
    n = len(ds.reviews)
    disk_key = f"{version}|{_dataset_fingerprint(ds)}"
    result = _load_sidecar(store, disk_key) if version else None
    if result is None or len(result.label) != n:
        label = np.full(n, -1, dtype=np.int8)
        source = np.full(n, -1, dtype=np.int8)
        ids, labels, sources, models, versions = store.label_rows()
        if ids:
            pos = pd.Index(ds.reviews["review_id"].astype(str)).get_indexer(ids)
            keep = pos >= 0  # labels for reviews no longer in the dataset are ignored
            label[pos[keep]] = labels[keep]
            source[pos[keep]] = sources[keep]
        result = Aligned(label, source, tuple(models), tuple(versions))
        if version:
            _save_sidecar(store, disk_key, result)
    with _lock:
        _aligned.clear()  # one store per process; keep memory bounded
        _aligned[key] = result
    return result


def _memo(ds: Dataset, store: SentimentStore, name: str, query, compute):
    """Cache a result per store version and query (results change only when labels do)."""
    return ds.memo(
        ("sentiment", name, str(store.path), store.version(), query.cache_key()), compute
    )


def _counts(codes: np.ndarray) -> np.ndarray:
    return np.bincount(codes[codes >= 0], minlength=len(LABELS))[: len(LABELS)]


def _shares(counts: np.ndarray) -> list[LabelShare]:
    total = int(counts.sum())
    return [
        LabelShare(label=lab, count=int(c), share=r4(c / total) if total else 0.0)
        for lab, c in zip(LABELS, counts, strict=True)
    ]


def _summary(ds: Dataset, store: SentimentStore, f: ReviewFilters) -> SentimentSummary:
    a = aligned_labels(ds, store)
    mask = review_mask(ds, f)
    codes = a.label[mask]
    total = int(mask.sum())
    classified = int((codes >= 0).sum())
    all_classified = int((a.label >= 0).sum())
    src = np.bincount(a.source[mask][a.source[mask] >= 0], minlength=len(SOURCES))
    sources = [NamedCount(name=s, count=int(c)) for s, c in zip(SOURCES, src, strict=True) if c]
    runs = store.runs(limit=1)
    status = (
        "not_started"
        if all_classified == 0
        else ("complete" if all_classified == len(ds.reviews) else "partial")
    )
    return SentimentSummary(
        status=status,
        total_reviews=total,
        classified=classified,
        coverage=r4(classified / total) if total else 0.0,
        dataset_classified=all_classified,
        dataset_reviews=len(ds.reviews),
        synthetic=any(s.name == "synthetic" for s in sources),
        sources=sources,
        models=list(a.models),
        prompt_versions=list(a.prompt_versions),
        distribution=_shares(_counts(codes)),
        last_run=SentimentRun(**{k: runs[0][k] for k in SentimentRun.model_fields})
        if runs
        else None,
    )


def _group_counts(ds: Dataset, a: Aligned, mask: np.ndarray, column: str) -> pd.DataFrame:
    """Per-group label counts via category codes and one bincount (no string grouping)."""
    col = ds.reviews[column]
    if not isinstance(col.dtype, pd.CategoricalDtype):
        col = col.astype("category")
    codes = col.cat.codes.to_numpy()
    sel = mask & (a.label >= 0) & (codes >= 0)
    k = len(LABELS)
    n_cat = len(col.cat.categories)
    grid = np.bincount(codes[sel].astype(np.int64) * k + a.label[sel], minlength=n_cat * k)
    grid = grid.reshape(n_cat, k)
    used = grid.sum(axis=1) > 0
    table = pd.DataFrame(grid[used], columns=list(LABELS))
    table.insert(0, "key", col.cat.categories.astype(str)[used])
    table["classified"] = table[list(LABELS)].sum(axis=1)
    for lab in LABELS:
        table[f"{lab}_share"] = table[lab] / table["classified"]
    table["net"] = table["positive_share"] - table["negative_share"]
    return table


COLUMN = {"brand": "brand_name", "subcategory": "subcategory", "product": "product_id"}


def _breakdown(
    ds: Dataset, store: SentimentStore, q: SentimentBreakdownQuery
) -> SentimentBreakdown:
    a = aligned_labels(ds, store)
    mask = review_mask(ds, q)
    table = _group_counts(ds, a, mask, COLUMN[q.by])
    eligible = table[table["classified"] >= q.min_classified]
    sort_col = q.sort_by if q.sort_by != "classified" else "classified"
    ordered = eligible.sort_values(
        [sort_col, "classified", "key"],
        ascending=[q.order == "asc", False, True],
        kind="mergesort",
    ).head(q.limit)
    names = ds.products_by_id["product_name"] if q.by == "product" else None
    brands = ds.products_by_id["brand_name"] if q.by == "product" else None
    items = [
        SentimentGroup(
            key=row["key"],
            name=str(names.get(row["key"], row["key"])) if names is not None else row["key"],
            brand_name=str(brands.get(row["key"])) if brands is not None else None,
            classified=int(row["classified"]),
            positive=int(row["positive"]),
            neutral=int(row["neutral"]),
            negative=int(row["negative"]),
            positive_share=r4(row["positive_share"]),
            neutral_share=r4(row["neutral_share"]),
            negative_share=r4(row["negative_share"]),
            net=r4(row["net"]),
        )
        for _, row in ordered.iterrows()
    ]
    return SentimentBreakdown(
        by=q.by, min_classified=q.min_classified, groups_total=len(eligible), items=items
    )


def _trend(ds: Dataset, store: SentimentStore, q: TrendQuery) -> SentimentTrend:
    a = aligned_labels(ds, store)
    sel = review_mask(ds, q) & (a.label >= 0)
    if not sel.any():
        return SentimentTrend(granularity=q.granularity, points=[])
    r = ds.reviews
    keys = period_keys(
        r["year"].to_numpy(dtype=np.int64)[sel],
        r["month"].to_numpy(dtype=np.int64)[sel],
        q.granularity,
    )
    labels = a.label[sel].astype(np.int64)
    base, size = int(keys.min()), int(keys.max() - keys.min()) + 1
    grid = np.bincount((keys - base) * len(LABELS) + labels, minlength=size * len(LABELS))
    grid = grid.reshape(size, len(LABELS))
    points = []
    for i in range(size):
        label, start = period_label(base + i, q.granularity)
        pos, neu, neg = (int(x) for x in grid[i])
        points.append(
            SentimentTrendPoint(
                period=label,
                period_start=start,
                classified=pos + neu + neg,
                positive=pos,
                neutral=neu,
                negative=neg,
            )
        )
    return SentimentTrend(granularity=q.granularity, points=points)


# ----------------------------------------------------------------------------- insights
def _pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def evidence(ds: Dataset, store: SentimentStore, f: ReviewFilters) -> dict[str, dict]:
    """Named, computed figures that insights may cite (AI insights can only cite these)."""
    a = aligned_labels(ds, store)
    mask = review_mask(ds, f)
    out: dict[str, dict] = {}
    counts = _counts(a.label[mask])
    total = int(counts.sum())
    if not total:
        return out
    overall = {lab: c / total for lab, c in zip(LABELS, counts, strict=True)}
    out["overall"] = {"classified": total, **{f"{k}_share": r4(v) for k, v in overall.items()}}
    for by in ("subcategory", "brand"):
        t = _group_counts(ds, a, mask, COLUMN[by])
        t = t[t["classified"] >= INSIGHT_MIN_CLASSIFIED]
        if len(t) < 2:
            continue
        for kind, col, asc in (
            ("most_negative", "negative_share", False),
            ("most_positive", "positive_share", False),
        ):
            row = t.sort_values([col, "classified", "key"], ascending=[asc, False, True]).iloc[0]
            out[f"{by}_{kind}"] = {
                by: row["key"],
                "classified": int(row["classified"]),
                "positive_share": r4(row["positive_share"]),
                "negative_share": r4(row["negative_share"]),
                "groups_compared": len(t),
            }
    # Mismatch: highly rated reviews whose text reads negative (a data-quality signal).
    ratings = ds.reviews["rating"].to_numpy()[mask]
    codes = a.label[mask]
    high = (ratings >= 4) & (codes >= 0)
    if high.sum() >= INSIGHT_MIN_CLASSIFIED:
        neg = int((codes[high] == LABELS.index("negative")).sum())
        out["high_rating_negative_text"] = {
            "classified": int(high.sum()),
            "negative": neg,
            "share": r4(neg / high.sum()),
        }
    # Year-over-year: first and last year with enough classified reviews.
    years = ds.reviews["year"].to_numpy()[mask]
    sel = codes >= 0
    yr = pd.DataFrame({"year": years[sel], "neg": codes[sel] == LABELS.index("negative")})
    per_year = yr.groupby("year")["neg"].agg(["count", "mean"])
    per_year = per_year[per_year["count"] >= INSIGHT_MIN_CLASSIFIED]
    if len(per_year) >= 2:
        first, last = per_year.index.min(), per_year.index.max()
        out["negative_share_change"] = {
            "from_year": int(first),
            "to_year": int(last),
            "from_share": r4(per_year.loc[first, "mean"]),
            "to_share": r4(per_year.loc[last, "mean"]),
            "from_classified": int(per_year.loc[first, "count"]),
            "to_classified": int(per_year.loc[last, "count"]),
        }
    return out


def _ev(pairs: list[tuple[str, str]]) -> list[Evidence]:
    return [Evidence(label=k, value=v) for k, v in pairs]


def computed_insights(ev: dict[str, dict]) -> list[SentimentInsight]:
    """Plain statements of computed figures; each carries its evidence."""
    items: list[SentimentInsight] = []
    if "overall" in ev:
        o = ev["overall"]
        items.append(
            SentimentInsight(
                id="overall",
                title="Overall sentiment",
                statement=f"{_pct(o['positive_share'])} of classified reviews read positive and "
                f"{_pct(o['negative_share'])} negative.",
                evidence=_ev(
                    [
                        ("Classified reviews", f"{o['classified']:,}"),
                        ("Positive", _pct(o["positive_share"])),
                        ("Negative", _pct(o["negative_share"])),
                    ]
                ),
            )
        )
    for by, noun, plural_noun in (
        ("subcategory", "subcategory", "subcategories"),
        ("brand", "brand", "brands"),
    ):
        key = f"{by}_most_negative"
        if key in ev and "overall" in ev:
            e, o = ev[key], ev["overall"]
            items.append(
                SentimentInsight(
                    id=key,
                    title=f"Most negative {noun}",
                    statement=f"{e[by]} has the highest negative share of the "
                    f"{e['groups_compared']} {plural_noun} with at least "
                    f"{INSIGHT_MIN_CLASSIFIED} classified reviews: "
                    f"{_pct(e['negative_share'])} versus {_pct(o['negative_share'])} overall.",
                    evidence=_ev(
                        [
                            (noun.capitalize(), e[by]),
                            ("Classified reviews", f"{e['classified']:,}"),
                            ("Negative share", _pct(e["negative_share"])),
                            ("Overall negative share", _pct(o["negative_share"])),
                        ]
                    ),
                )
            )
    if "high_rating_negative_text" in ev:
        e = ev["high_rating_negative_text"]
        items.append(
            SentimentInsight(
                id="high_rating_negative_text",
                title="Ratings and text disagree",
                statement=f"{_pct(e['share'])} of 4–5 star reviews have text classified as "
                "negative.",
                evidence=_ev(
                    [
                        ("4–5 star classified reviews", f"{e['classified']:,}"),
                        ("Negative text", f"{e['negative']:,}"),
                    ]
                ),
            )
        )
    if "negative_share_change" in ev:
        e = ev["negative_share_change"]
        direction = (
            "rose"
            if e["to_share"] > e["from_share"]
            else "fell"
            if e["to_share"] < e["from_share"]
            else "held"
        )
        items.append(
            SentimentInsight(
                id="negative_share_change",
                title="Negative sentiment over time",
                statement=f"The negative share {direction} from {_pct(e['from_share'])} in "
                f"{e['from_year']} to {_pct(e['to_share'])} in {e['to_year']}.",
                evidence=_ev(
                    [
                        (
                            str(e["from_year"]),
                            f"{_pct(e['from_share'])} of {e['from_classified']:,}",
                        ),
                        (str(e["to_year"]), f"{_pct(e['to_share'])} of {e['to_classified']:,}"),
                    ]
                ),
            )
        )
    return items


def _insights(ds: Dataset, store: SentimentStore, f: ReviewFilters) -> SentimentInsights:
    stored = store.latest_insights()
    ai = None
    if stored and not f.has_review_filters:  # AI insights describe the unfiltered dataset
        ai = StoredInsights(
            created_at=stored["created_at"],
            model=stored["model"],
            items=[SentimentInsight(**item) for item in stored["items"]],
        )
    return SentimentInsights(
        min_classified=INSIGHT_MIN_CLASSIFIED,
        computed=computed_insights(evidence(ds, store, f)),
        ai=ai,
    )


# ----------------------------------------------------------------------------- public (cached)
def summary(ds: Dataset, store: SentimentStore, f: ReviewFilters) -> SentimentSummary:
    return _memo(ds, store, "summary", f, lambda: _summary(ds, store, f))


def breakdown(ds: Dataset, store: SentimentStore, q: SentimentBreakdownQuery) -> SentimentBreakdown:
    return _memo(ds, store, "breakdown", q, lambda: _breakdown(ds, store, q))


def trend(ds: Dataset, store: SentimentStore, q: TrendQuery) -> SentimentTrend:
    return _memo(ds, store, "trend", q, lambda: _trend(ds, store, q))


def insights(ds: Dataset, store: SentimentStore, f: ReviewFilters) -> SentimentInsights:
    return _memo(ds, store, "insights", f, lambda: _insights(ds, store, f))
