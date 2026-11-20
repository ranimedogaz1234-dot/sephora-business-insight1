"""Brand analytics."""

from __future__ import annotations

import pandas as pd

from app.data.dataset import Dataset
from app.schemas.queries import BrandListQuery, BrandReviewStatsQuery, TopBrandsQuery
from app.schemas.responses import (
    BrandItem,
    BrandReviewStat,
    BrandReviewStats,
    Page,
    RankedBrand,
    TopBrands,
)
from app.services.common import (
    contains_ci,
    filtered_reviews,
    group_stats,
    paginate,
    r4,
    rank,
    sort_frame,
)


def brand_table(ds: Dataset) -> pd.DataFrame:
    """One row per catalogue brand (all 304), with catalogue figures and, separately,
    review-record figures (zero/None for brands without Skincare review records)."""

    def compute() -> pd.DataFrame:
        p = ds.products
        g = p.groupby("brand_name", observed=True)
        t = pd.DataFrame(
            {
                "product_count": g.size(),
                "category_count": g["primary_category"].nunique(),
                "average_price": g["price_usd"].mean(),
                "loves_count": g["loves_count"].sum(),
                "sephora_review_count": g["sephora_review_count"].sum(),
            }
        )
        t.index = t.index.astype(str)
        stats = group_stats(ds.reviews, "brand_name").set_index("brand_name")
        t["review_record_count"] = stats["review_count"].reindex(t.index).fillna(0).astype("int64")
        t["review_average_rating"] = stats["average_rating"].reindex(t.index)
        return t.rename_axis("brand_name").reset_index()

    return ds.memo("brand_table", compute)


def _brand_item(row: pd.Series) -> BrandItem:
    return BrandItem(
        brand_name=row["brand_name"],
        product_count=int(row["product_count"]),
        category_count=int(row["category_count"]),
        average_price_usd=r4(row["average_price"]),
        loves_count=int(row["loves_count"]),
        sephora_review_count=int(row["sephora_review_count"]),
        review_record_count=int(row["review_record_count"]),
        review_average_rating=r4(row["review_average_rating"]),
    )


def get_brand(ds: Dataset, brand: str) -> BrandItem | None:
    """Catalogue and review-record figures for one brand (exact, case-sensitive name)."""
    t = brand_table(ds)
    hit = t[(t["brand_name"] == brand).to_numpy()]
    return _brand_item(hit.iloc[0]) if len(hit) else None


def list_brands(ds: Dataset, q: BrandListQuery) -> Page[BrandItem]:
    t = brand_table(ds)
    if q.q:
        t = t[contains_ci(t["brand_name"], q.q).to_numpy()]
    ordered = sort_frame(t, q.sort_by, q.order == "asc", "brand_name")
    window, total_pages = paginate(len(ordered), q.page, q.page_size)
    items = [_brand_item(row) for _, row in ordered.iloc[window].iterrows()]
    return Page[BrandItem](
        items=items, page=q.page, page_size=q.page_size, total=len(ordered), total_pages=total_pages
    )


def top_brands(ds: Dataset, q: TopBrandsQuery) -> TopBrands:
    def compute() -> TopBrands:
        r = filtered_reviews(ds, q)
        top = rank(group_stats(r, "brand_name"), "brand_name", q.limit)
        total = len(r)
        return TopBrands(
            total_reviews=total,
            items=[
                RankedBrand(
                    rank=i + 1,
                    brand_name=row["brand_name"],
                    review_count=int(row["review_count"]),
                    share=r4(row["review_count"] / total),
                    average_rating=r4(row["average_rating"]),
                    reviewed_products=int(row["reviewed_products"]),
                )
                for i, (_, row) in enumerate(top.iterrows())
            ],
        )

    return ds.memo(("top_brands", q.limit, q.review_filters_key()), compute)


def brand_review_stats(ds: Dataset, q: BrandReviewStatsQuery) -> BrandReviewStats:
    """Review statistics per brand. Brands below ``min_reviews`` are excluded, so rate
    rankings (highest rated, most recommended) are not led by a handful of reviews.
    Ties: review count desc, then brand name asc; missing rates sort last."""

    def compute() -> BrandReviewStats:
        r = filtered_reviews(ds, q)
        stats = group_stats(r, "brand_name") if len(r) else None
        if stats is None or stats.empty:
            return BrandReviewStats(
                total_reviews=len(r),
                brands_with_reviews=0,
                min_reviews=q.min_reviews,
                brands_meeting_threshold=0,
                items=[],
            )
        eligible = stats[stats["review_count"] >= q.min_reviews]
        asc = q.order == "asc"
        if q.sort_by == "review_count":
            ordered = eligible.sort_values(
                ["review_count", "brand_name"], ascending=[asc, True], kind="mergesort"
            )
        else:
            ordered = eligible.sort_values(
                [q.sort_by, "review_count", "brand_name"],
                ascending=[asc, False, True],
                na_position="last",
                kind="mergesort",
            )
        total = len(r)
        return BrandReviewStats(
            total_reviews=total,
            brands_with_reviews=len(stats),
            min_reviews=q.min_reviews,
            brands_meeting_threshold=len(eligible),
            items=[
                BrandReviewStat(
                    rank=i + 1,
                    brand_name=row["brand_name"],
                    review_count=int(row["review_count"]),
                    share=r4(row["review_count"] / total),
                    average_rating=r4(row["average_rating"]),
                    five_star_share=r4(row["five_star_share"]),
                    recommendation_rate=r4(row["recommendation_rate"]),
                    reviewed_products=int(row["reviewed_products"]),
                )
                for i, (_, row) in enumerate(ordered.head(q.limit).iterrows())
            ],
        )

    return ds.memo(("brand_review_stats", q.cache_key()), compute)
