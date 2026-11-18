"""Independent reference implementation used to validate the API.

Reads the CSV files with the standard-library ``csv`` module only (no pandas, no
application code) and recomputes the figures the API serves. Exact duplicates are
detected on the raw field values of every column except the CSV row index.

Memory: review text is not retained; rows are reduced to the fields needed for
analytics plus pre-computed matches for a fixed set of search terms.
"""

from __future__ import annotations

import csv
import hashlib
import statistics
import sys
from collections import Counter, defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from pathlib import Path

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

SEARCH_TERMS = ("holy grail", "serum")


@dataclass(slots=True)
class Rev:
    author: str
    rating: int
    rec: float | None
    date: str  # YYYY-MM-DD
    pid: str
    brand: str
    skin_type: str
    helpfulness: float | None
    matches: frozenset[str]


@dataclass
class Oracle:
    products: dict[str, dict[str, str]]
    reviews: list[Rev]
    raw_count: int
    review_files: list[str] = field(default_factory=list)

    # ------------------------------------------------------------------ loading
    @classmethod
    def load(cls, data_dir: Path) -> Oracle:
        with (data_dir / "product_info.csv").open(newline="", encoding="utf-8") as f:
            products = {row["product_id"]: row for row in csv.DictReader(f)}
        seen: set[bytes] = set()
        reviews: list[Rev] = []
        raw = 0
        files = sorted(p.name for p in data_dir.glob("reviews_*.csv"))
        for name in files:
            with (data_dir / name).open(newline="", encoding="utf-8") as f:
                reader = csv.reader(f)
                header = next(reader)
                idx = {h: i for i, h in enumerate(header)}
                keep = [i for i, h in enumerate(header) if h and not h.startswith("Unnamed")]
                for row in reader:
                    raw += 1
                    digest = hashlib.blake2b(
                        "\x1f".join(row[i] for i in keep).encode(), digest_size=16
                    ).digest()
                    if digest in seen:
                        continue
                    seen.add(digest)
                    text = (row[idx["review_title"]] + "\n" + row[idx["review_text"]]).lower()
                    reviews.append(
                        Rev(
                            author=row[idx["author_id"]],
                            rating=int(float(row[idx["rating"]])),
                            rec=float(row[idx["is_recommended"]])
                            if row[idx["is_recommended"]]
                            else None,
                            date=row[idx["submission_time"]][:10],
                            pid=row[idx["product_id"]],
                            brand=row[idx["brand_name"]],
                            skin_type=row[idx["skin_type"]],
                            helpfulness=float(row[idx["helpfulness"]])
                            if row[idx["helpfulness"]]
                            else None,
                            matches=frozenset(t for t in SEARCH_TERMS if t in text),
                        )
                    )
        return cls(products=products, reviews=reviews, raw_count=raw, review_files=files)

    # ------------------------------------------------------------------ helpers
    def subcategory(self, pid: str) -> str:
        return self.products[pid]["secondary_category"]

    def select(
        self,
        *,
        date_from: str | None = None,
        date_to: str | None = None,
        brand: Iterable[str] = (),
        subcategory: Iterable[str] = (),
        rating: Iterable[int] = (),
        recommended: bool | None = None,
        skin_type: Iterable[str] = (),
        year: int | None = None,
    ) -> list[Rev]:
        brand, subcategory, rating, skin_type = (
            set(brand),
            set(subcategory),
            set(rating),
            set(skin_type),
        )
        out = []
        for r in self.reviews:
            if date_from and r.date < date_from:
                continue
            if date_to and r.date > date_to:
                continue
            if brand and r.brand not in brand:
                continue
            if subcategory and self.subcategory(r.pid) not in subcategory:
                continue
            if rating and r.rating not in rating:
                continue
            if recommended is not None and r.rec != (1.0 if recommended else 0.0):
                continue
            if skin_type and r.skin_type not in skin_type:
                continue
            if year is not None and int(r.date[:4]) != year:
                continue
            out.append(r)
        return out

    # ------------------------------------------------------------------ catalogue
    def catalogue(self) -> dict:
        prices = [float(p["price_usd"]) for p in self.products.values()]
        return {
            "total_products": len(self.products),
            "total_brands": len({p["brand_name"] for p in self.products.values()}),
            "total_categories": len({p["primary_category"] for p in self.products.values()}),
            "sephora_review_count": int(
                sum(float(p["reviews"]) for p in self.products.values() if p["reviews"])
            ),
            "average_price_usd": statistics.fmean(prices),
            "median_price_usd": statistics.median(prices),
        }

    def catalogue_categories(self, parent: str | None = None) -> dict[str, int]:
        if parent is None:
            return dict(Counter(p["primary_category"] for p in self.products.values()))
        return dict(
            Counter(
                p["secondary_category"] or "Unspecified"
                for p in self.products.values()
                if p["primary_category"] == parent
            )
        )

    def price_bins(self, bin_width: int, max_price: int) -> list[int]:
        n = -(-max_price // bin_width)
        counts = [0] * (n + 1)
        for p in self.products.values():
            price = float(p["price_usd"])
            counts[n if price >= max_price else int(price // bin_width)] += 1
        return counts

    def products_matching(self, q: str) -> int:
        q = q.lower()
        return sum(
            1
            for p in self.products.values()
            if q in p["product_name"].lower() or q in p["brand_name"].lower()
        )

    # ------------------------------------------------------------------ reviews
    @staticmethod
    def kpis(rs: list[Rev]) -> dict:
        n = len(rs)
        answered = [r.rec for r in rs if r.rec is not None]
        return {
            "review_count": n,
            "average_rating": statistics.fmean(r.rating for r in rs) if n else None,
            "five_star_share": sum(r.rating == 5 for r in rs) / n if n else None,
            "recommendation_rate": statistics.fmean(answered) if answered else None,
            "recommendation_responses": len(answered),
            "unique_reviewers": len({r.author for r in rs}),
            "reviewed_products": len({r.pid for r in rs}),
            "reviewed_brands": len({r.brand for r in rs}),
            "first_review_date": min(r.date for r in rs) if n else None,
            "last_review_date": max(r.date for r in rs) if n else None,
        }

    @staticmethod
    def rating_counts(rs: list[Rev]) -> list[int]:
        c = Counter(r.rating for r in rs)
        return [c.get(i, 0) for i in range(1, 6)]

    @staticmethod
    def group(rs: list[Rev], key: Callable[[Rev], str]) -> dict[str, tuple[int, float]]:
        """key -> (review_count, average_rating)"""
        acc: dict[str, list[int]] = defaultdict(list)
        for r in rs:
            acc[key(r)].append(r.rating)
        return {k: (len(v), statistics.fmean(v)) for k, v in acc.items()}

    @staticmethod
    def ranking(groups: dict[str, tuple[int, float]], limit: int) -> list[tuple[str, int]]:
        ordered = sorted(groups.items(), key=lambda kv: (-kv[1][0], kv[0]))
        return [(k, v[0]) for k, v in ordered[:limit]]

    @staticmethod
    def by_period(rs: list[Rev], width: int) -> dict[str, int]:
        return dict(Counter(r.date[:width] for r in rs))

    def search_count(self, term: str, rs: list[Rev] | None = None) -> int:
        assert term in SEARCH_TERMS
        return sum(term in r.matches for r in (self.reviews if rs is None else rs))
