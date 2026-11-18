"""Helpers shared by the analytics services."""

from __future__ import annotations

import math
from datetime import date

import numpy as np
import pandas as pd

from app.data.dataset import Dataset
from app.schemas.queries import ReviewFilters

REVIEW_SCOPE_CATEGORY = "Skincare"
RATINGS = (1, 2, 3, 4, 5)


def r4(value: float | None) -> float | None:
    """Round to 4 decimals; NaN/None -> None."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return round(float(value), 4)


def to_date(value) -> date | None:
    return None if value is None or pd.isna(value) else pd.Timestamp(value).date()


def none_if_na(value):
    return None if value is None or pd.isna(value) else value


def review_mask(ds: Dataset, f: ReviewFilters) -> np.ndarray:
    """Boolean mask over ``ds.reviews`` for the review filters."""
    r = ds.reviews
    mask = np.ones(len(r), dtype=bool)
    if f.date_from is not None:
        mask &= (r["submission_time"] >= pd.Timestamp(f.date_from)).to_numpy()
    if f.date_to is not None:
        end = pd.Timestamp(f.date_to) + pd.Timedelta(days=1)
        mask &= (r["submission_time"] < end).to_numpy()
    for field, column in (
        ("brand", "brand_name"),
        ("subcategory", "subcategory"),
        ("product_id", "product_id"),
        ("skin_type", "skin_type"),
    ):
        values = getattr(f, field)
        if values:
            mask &= r[column].isin(values).to_numpy()
    if f.rating:
        mask &= np.isin(r["rating"].to_numpy(), f.rating)
    if f.recommended is not None:
        mask &= (r["is_recommended"] == (1.0 if f.recommended else 0.0)).to_numpy()
    return mask


def filtered_reviews(ds: Dataset, f: ReviewFilters) -> pd.DataFrame:
    if not f.has_review_filters:
        return ds.reviews
    return ds.reviews[review_mask(ds, f)]


def rating_summary(ratings: pd.Series) -> tuple[int, float | None, float | None]:
    n = len(ratings)
    if n == 0:
        return 0, None, None
    values = ratings.to_numpy()
    return n, r4(values.mean()), r4((values == 5).mean())


def recommendation_rate(values: pd.Series) -> tuple[float | None, int]:
    answered = values.dropna()
    return (r4(answered.mean()) if len(answered) else None), int(len(answered))


def group_stats(r: pd.DataFrame, key: str) -> pd.DataFrame:
    """Per-group review stats for a categorical column using bincount (fast on 1M rows).

    Returns columns: key, review_count, average_rating, five_star_share,
    recommendation_rate, reviewed_products. Groups without reviews are dropped.
    """
    col = r[key]
    if not isinstance(col.dtype, pd.CategoricalDtype):
        col = col.astype("category")
    codes = col.cat.codes.to_numpy()
    valid = codes >= 0
    codes = codes[valid]
    n = len(col.cat.categories)
    ratings = r["rating"].to_numpy(dtype=np.float64)[valid]
    rec = r["is_recommended"].to_numpy(dtype=np.float64)[valid]
    answered = ~np.isnan(rec)

    count = np.bincount(codes, minlength=n)
    rating_sum = np.bincount(codes, weights=ratings, minlength=n)
    fives = np.bincount(codes, weights=ratings == 5, minlength=n)
    rec_n = np.bincount(codes[answered], minlength=n)
    rec_sum = np.bincount(codes[answered], weights=rec[answered], minlength=n)

    if key == "product_id":
        products = (count > 0).astype(np.int64)
    else:
        # Distinct products per group: mark (group, product) cells present in a dense grid.
        n_products = len(r["product_id"].cat.categories)
        product_codes = r["product_id"].cat.codes.to_numpy()[valid].astype(np.int64)
        present = np.zeros(n * n_products, dtype=bool)
        present[codes.astype(np.int64) * n_products + product_codes] = True
        products = present.reshape(n, n_products).sum(axis=1)

    with np.errstate(invalid="ignore", divide="ignore"):
        out = pd.DataFrame(
            {
                key: col.cat.categories.astype(str),
                "review_count": count,
                "average_rating": rating_sum / count,
                "five_star_share": fives / count,
                "recommendation_rate": np.where(rec_n > 0, rec_sum / np.maximum(rec_n, 1), np.nan),
                "reviewed_products": products,
            }
        )
    return out[out["review_count"] > 0].reset_index(drop=True)


def rank(stats: pd.DataFrame, key: str, limit: int | None = None) -> pd.DataFrame:
    """Order by review_count desc, then key asc (deterministic)."""
    ordered = stats.sort_values(["review_count", key], ascending=[False, True], kind="mergesort")
    return ordered.head(limit) if limit else ordered


def paginate(n_total: int, page: int, page_size: int) -> tuple[slice, int]:
    total_pages = max(1, math.ceil(n_total / page_size)) if n_total else 0
    start = (page - 1) * page_size
    return slice(start, start + page_size), total_pages


def sort_frame(df: pd.DataFrame, by: str, ascending: bool, tiebreak: str) -> pd.DataFrame:
    """Sort with NaN last and a deterministic tie-break column (always ascending)."""
    return df.sort_values(
        [by, tiebreak], ascending=[ascending, True], na_position="last", kind="mergesort"
    )


def contains_ci(series: pd.Series, needle: str) -> pd.Series:
    """Literal (non-regex), case-insensitive substring match; NA -> False."""
    return series.str.contains(needle, case=False, regex=False, na=False)
