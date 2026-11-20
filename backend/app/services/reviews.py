"""Review analytics: rating distribution, trends, activity heatmap, review explorer."""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

from app.data.dataset import Dataset
from app.schemas.queries import ReviewFilters, ReviewListQuery, TrendQuery
from app.schemas.responses import (
    ActivityHeatmap,
    HeatmapCell,
    Page,
    ProfileDimension,
    ProfileSegment,
    RatingBucket,
    RatingDistribution,
    ReviewerProfiles,
    ReviewItem,
    ReviewTrend,
    TrendPoint,
)
from app.services.common import (
    RATINGS,
    contains_ci,
    filtered_reviews,
    group_stats,
    none_if_na,
    paginate,
    r4,
    rank,
    review_mask,
)

PROFILE_DIMENSIONS = ("skin_type", "skin_tone", "eye_color", "hair_color")


def rating_buckets(ratings: pd.Series) -> list[RatingBucket]:
    counts = np.bincount(ratings.to_numpy(dtype=np.int64), minlength=6)[1:6]
    total = int(counts.sum())
    return [
        RatingBucket(rating=r, count=int(c), share=r4(c / total) if total else 0.0)
        for r, c in zip(RATINGS, counts, strict=True)
    ]


def rating_distribution(ds: Dataset, f: ReviewFilters) -> RatingDistribution:
    def compute() -> RatingDistribution:
        ratings = filtered_reviews(ds, f)["rating"]
        return RatingDistribution(
            total=len(ratings),
            average_rating=r4(ratings.mean()) if len(ratings) else None,
            buckets=rating_buckets(ratings),
        )

    return ds.memo(("rating_distribution", f.review_filters_key()), compute)


def period_keys(year: np.ndarray, month: np.ndarray, granularity: str) -> np.ndarray:
    if granularity == "year":
        return year
    if granularity == "quarter":
        return year * 4 + (month - 1) // 3
    return year * 12 + (month - 1)


def period_label(key: int, granularity: str) -> tuple[str, date]:
    if granularity == "year":
        return str(key), date(key, 1, 1)
    if granularity == "quarter":
        y, q = divmod(key, 4)
        return f"{y}-Q{q + 1}", date(y, q * 3 + 1, 1)
    y, m = divmod(key, 12)
    return f"{y}-{m + 1:02d}", date(y, m + 1, 1)


def review_trend(ds: Dataset, q: TrendQuery) -> ReviewTrend:
    """Review volume and rating per period; gaps between first and last period are zero-filled."""

    def compute() -> ReviewTrend:
        r = filtered_reviews(ds, q)
        if r.empty:
            return ReviewTrend(granularity=q.granularity, total=0, points=[])
        keys = period_keys(
            r["year"].to_numpy(dtype=np.int64), r["month"].to_numpy(dtype=np.int64), q.granularity
        )
        ratings = r["rating"].to_numpy(dtype=np.int64)
        base = int(keys.min())
        offs = keys - base
        size = int(offs.max()) + 1
        counts = np.bincount(offs, minlength=size)
        sums = np.bincount(offs, weights=ratings, minlength=size)
        fives = np.bincount(offs, weights=(ratings == 5), minlength=size)
        points = []
        for i in range(size):
            label, start = period_label(base + i, q.granularity)
            c = int(counts[i])
            points.append(
                TrendPoint(
                    period=label,
                    period_start=start,
                    review_count=c,
                    average_rating=r4(sums[i] / c) if c else None,
                    five_star_share=r4(fives[i] / c) if c else None,
                )
            )
        return ReviewTrend(granularity=q.granularity, total=len(r), points=points)

    return ds.memo(("trend", q.granularity, q.review_filters_key()), compute)


def activity_heatmap(ds: Dataset, f: ReviewFilters) -> ActivityHeatmap:
    """Review counts on a year x month grid (all 12 months for every year in range)."""

    def compute() -> ActivityHeatmap:
        r = filtered_reviews(ds, f)
        if r.empty:
            return ActivityHeatmap(years=[], months=list(range(1, 13)), max_count=0, cells=[])
        years = r["year"].to_numpy(dtype=np.int64)
        months = r["month"].to_numpy(dtype=np.int64)
        y0, y1 = int(years.min()), int(years.max())
        grid = np.bincount((years - y0) * 12 + (months - 1), minlength=(y1 - y0 + 1) * 12)
        cells = [
            HeatmapCell(year=y0 + i // 12, month=i % 12 + 1, review_count=int(c))
            for i, c in enumerate(grid)
        ]
        return ActivityHeatmap(
            years=list(range(y0, y1 + 1)),
            months=list(range(1, 13)),
            max_count=int(grid.max()),
            cells=cells,
        )

    return ds.memo(("heatmap", f.review_filters_key()), compute)


def reviewer_profiles(ds: Dataset, f: ReviewFilters) -> ReviewerProfiles:
    """Review counts and ratings per self-reported reviewer attribute (aggregates only).

    Shares are computed among reviews that answered the attribute; unanswered reviews
    are reported separately as ``missing`` rather than as a segment.
    """

    def compute() -> ReviewerProfiles:
        r = filtered_reviews(ds, f)
        dimensions = []
        for dim in PROFILE_DIMENSIONS:
            stats = rank(group_stats(r, dim), dim) if len(r) else None
            answered = int(stats["review_count"].sum()) if stats is not None else 0
            segments = (
                [
                    ProfileSegment(
                        value=str(row[dim]),
                        review_count=int(row["review_count"]),
                        share=r4(row["review_count"] / answered),
                        average_rating=r4(row["average_rating"]),
                        five_star_share=r4(row["five_star_share"]),
                        recommendation_rate=r4(row["recommendation_rate"]),
                    )
                    for _, row in stats.iterrows()
                ]
                if stats is not None
                else []
            )
            dimensions.append(
                ProfileDimension(
                    dimension=dim, answered=answered, missing=len(r) - answered, segments=segments
                )
            )
        return ReviewerProfiles(total_reviews=len(r), dimensions=dimensions)

    return ds.memo(("profiles", f.review_filters_key()), compute)


# ----------------------------------------------------------------------------- explorer
def _ordered_positions(ds: Dataset, positions: np.ndarray, sort_by: str, asc: bool) -> np.ndarray:
    """Order row positions. Rows are stored by (submission_time, review_id), so position is
    the deterministic tie-break, applied in the same direction as the primary key."""
    if sort_by == "submission_time":
        return positions if asc else positions[::-1]
    values = ds.reviews[sort_by].to_numpy(dtype=np.float64)[positions]
    key = values if asc else -values
    key = np.where(np.isnan(key), np.inf, key)  # missing values always last
    tiebreak = positions if asc else -positions
    return positions[np.lexsort((tiebreak, key))]


def _review_item(ds: Dataset, pos: int) -> ReviewItem:
    row = ds.reviews.iloc[pos]
    text = ds.review_texts.iloc[pos]
    product = ds.products_by_id.loc[str(row["product_id"])]
    rec = row["is_recommended"]
    return ReviewItem(
        review_id=str(row["review_id"]),
        product_id=str(row["product_id"]),
        product_name=str(product["product_name"]),
        brand_name=str(row["brand_name"]),
        subcategory=none_if_na(row["subcategory"]),
        rating=int(row["rating"]),
        is_recommended=None if pd.isna(rec) else bool(rec),
        helpfulness=r4(none_if_na(row["helpfulness"])),
        total_feedback_count=int(row["total_feedback_count"]),
        total_pos_feedback_count=int(row["total_pos_feedback_count"]),
        total_neg_feedback_count=int(row["total_neg_feedback_count"]),
        submission_date=pd.Timestamp(row["submission_time"]).date(),
        review_title=none_if_na(text["review_title"]),
        review_text=none_if_na(text["review_text"]),
        skin_tone=none_if_na(row["skin_tone"]),
        skin_type=none_if_na(row["skin_type"]),
        eye_color=none_if_na(row["eye_color"]),
        hair_color=none_if_na(row["hair_color"]),
    )


def _matching_positions(ds: Dataset, q: ReviewListQuery) -> np.ndarray:
    """Row positions matching filters + text search, in stored (time, id) order."""
    positions = np.flatnonzero(review_mask(ds, q))
    if not q.q or not len(positions):
        return positions

    def search() -> np.ndarray:
        texts = ds.review_texts
        hit = (
            contains_ci(texts["review_title"].iloc[positions], q.q).to_numpy()
            | contains_ci(texts["review_text"].iloc[positions], q.q).to_numpy()
        )
        result = positions[hit]
        result.setflags(write=False)
        return result

    # Text search is the costly step; memoise its hits so paging/sorting is fast.
    return ds.memo(("search", q.q, q.review_filters_key()), search, bucket="search")


def list_reviews(ds: Dataset, q: ReviewListQuery) -> Page[ReviewItem]:
    positions = _matching_positions(ds, q)
    ordered = _ordered_positions(ds, positions, q.sort_by, q.order == "asc")
    window, total_pages = paginate(len(ordered), q.page, q.page_size)
    items = [_review_item(ds, int(p)) for p in ordered[window]]
    return Page[ReviewItem](
        items=items,
        page=q.page,
        page_size=q.page_size,
        total=len(ordered),
        total_pages=total_pages,
    )


def get_review(ds: Dataset, review_id: str) -> ReviewItem | None:
    hits = np.flatnonzero((ds.reviews["review_id"] == review_id).to_numpy())
    return _review_item(ds, int(hits[0])) if len(hits) else None
