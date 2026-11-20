"""Product analytics (review rankings) and the product catalogue."""

from __future__ import annotations

import ast

import numpy as np
import pandas as pd

from app.data.dataset import Dataset
from app.schemas.queries import (
    ProductCompareQuery,
    ProductListQuery,
    RatingPopularityQuery,
    TopProductsByYearQuery,
    TopProductsQuery,
)
from app.schemas.responses import (
    ComparedProduct,
    ComparisonPeriod,
    Page,
    PopularityPoint,
    ProductComparison,
    ProductDetail,
    ProductItem,
    ProductReviewStats,
    RankedProduct,
    RatingPopularity,
    YearCount,
    YearRanking,
)
from app.services.common import (
    contains_ci,
    filtered_reviews,
    group_stats,
    none_if_na,
    paginate,
    r4,
    rank,
    rating_summary,
    recommendation_rate,
    sort_frame,
    to_date,
)
from app.services.reviews import period_keys, period_label, rating_buckets

CATALOGUE_FLAGS = ("new", "limited_edition", "sephora_exclusive", "online_only", "out_of_stock")


def _ranked(ds: Dataset, stats: pd.DataFrame, limit: int) -> list[RankedProduct]:
    top = rank(stats, "product_id", limit)
    info = ds.products_by_id.loc[top["product_id"]]
    return [
        RankedProduct(
            rank=i + 1,
            product_id=pid,
            product_name=str(p["product_name"]),
            brand_name=str(p["brand_name"]),
            subcategory=none_if_na(p["secondary_category"]),
            price_usd=float(p["price_usd"]),
            review_count=int(s["review_count"]),
            average_rating=r4(s["average_rating"]),
            five_star_share=r4(s["five_star_share"]),
        )
        for i, ((_, s), (pid, p)) in enumerate(zip(top.iterrows(), info.iterrows(), strict=True))
    ]


def top_reviewed_products(ds: Dataset, q: TopProductsQuery) -> list[RankedProduct]:
    def compute() -> list[RankedProduct]:
        return _ranked(ds, group_stats(filtered_reviews(ds, q), "product_id"), q.limit)

    return ds.memo(("top_products", q.limit, q.review_filters_key()), compute)


def top_products_by_year(ds: Dataset, q: TopProductsByYearQuery) -> YearRanking:
    def compute() -> YearRanking:
        r = filtered_reviews(ds, q)
        r = r[r["year"].to_numpy() == q.year]
        return YearRanking(
            year=q.year,
            total_reviews_in_year=len(r),
            items=_ranked(ds, group_stats(r, "product_id"), q.limit) if len(r) else [],
        )

    return ds.memo(("top_by_year", q.year, q.limit, q.review_filters_key()), compute)


def review_years(ds: Dataset) -> list[YearCount]:
    def compute() -> list[YearCount]:
        counts = ds.reviews["year"].value_counts().sort_index()
        return [YearCount(year=int(y), review_count=int(c)) for y, c in counts.items()]

    return ds.memo("review_years", compute)


def rating_popularity(ds: Dataset, q: RatingPopularityQuery) -> RatingPopularity:
    def compute() -> RatingPopularity:
        stats = group_stats(filtered_reviews(ds, q), "product_id")
        stats = stats[stats["review_count"] >= q.min_reviews]
        top = rank(stats, "product_id", q.limit)
        info = ds.products_by_id.loc[top["product_id"]]
        points = [
            PopularityPoint(
                product_id=pid,
                product_name=str(p["product_name"]),
                brand_name=str(p["brand_name"]),
                subcategory=none_if_na(p["secondary_category"]),
                price_usd=float(p["price_usd"]),
                loves_count=int(p["loves_count"]),
                review_count=int(s["review_count"]),
                average_rating=r4(s["average_rating"]),
            )
            for (_, s), (pid, p) in zip(top.iterrows(), info.iterrows(), strict=True)
        ]
        return RatingPopularity(total_products=len(stats), returned=len(points), points=points)

    return ds.memo(("rating_popularity", q.min_reviews, q.limit, q.review_filters_key()), compute)


# ----------------------------------------------------------------------------- catalogue
def product_table(ds: Dataset) -> pd.DataFrame:
    """Catalogue rows + unfiltered review-record stats (kept in separate, labelled columns)."""

    def compute() -> pd.DataFrame:
        stats = group_stats(ds.reviews, "product_id").set_index("product_id")
        t = ds.products.copy()
        t["review_record_count"] = (
            stats["review_count"].reindex(t["product_id"]).fillna(0).astype("int64").to_numpy()
        )
        t["review_average_rating"] = stats["average_rating"].reindex(t["product_id"]).to_numpy()
        t["brand_name_text"] = t["brand_name"].astype(str)
        return t

    return ds.memo("product_table", compute)


def _product_item(row: pd.Series) -> dict:
    return {
        "product_id": str(row["product_id"]),
        "product_name": str(row["product_name"]),
        "brand_name": str(row["brand_name"]),
        "primary_category": str(row["primary_category"]),
        "secondary_category": none_if_na(row["secondary_category"]),
        "tertiary_category": none_if_na(row["tertiary_category"]),
        "price_usd": float(row["price_usd"]),
        "sale_price_usd": none_if_na(row["sale_price_usd"]),
        "loves_count": int(row["loves_count"]),
        "catalogue_rating": r4(none_if_na(row["catalogue_rating"])),
        "sephora_review_count": none_if_na(row["sephora_review_count"]),
        "review_record_count": int(row["review_record_count"]),
        "review_average_rating": r4(none_if_na(row["review_average_rating"])),
        **{flag: bool(row[flag]) for flag in CATALOGUE_FLAGS},
    }


def list_products(ds: Dataset, q: ProductListQuery) -> Page[ProductItem]:
    t = product_table(ds)
    m = np.ones(len(t), dtype=bool)
    if q.q:
        m &= (
            contains_ci(t["product_name"], q.q) | contains_ci(t["brand_name_text"], q.q)
        ).to_numpy()
    for field, column in (
        ("primary_category", "primary_category"),
        ("secondary_category", "secondary_category"),
        ("brand", "brand_name"),
    ):
        values = getattr(q, field)
        if values:
            m &= t[column].isin(values).to_numpy()
    if q.price_min is not None:
        m &= (t["price_usd"] >= q.price_min).to_numpy()
    if q.price_max is not None:
        m &= (t["price_usd"] <= q.price_max).to_numpy()
    if q.min_catalogue_rating is not None:
        m &= (t["catalogue_rating"] >= q.min_catalogue_rating).fillna(False).to_numpy()
    if q.has_review_records is not None:
        m &= ((t["review_record_count"] > 0) == q.has_review_records).to_numpy()
    for flag in CATALOGUE_FLAGS:
        value = getattr(q, flag)
        if value is not None:
            m &= (t[flag] == value).to_numpy()

    sort_col = "brand_name_text" if q.sort_by == "brand_name" else q.sort_by
    ordered = sort_frame(t[m], sort_col, q.order == "asc", "product_id")
    window, total_pages = paginate(len(ordered), q.page, q.page_size)
    items = [ProductItem(**_product_item(row)) for _, row in ordered.iloc[window].iterrows()]
    return Page[ProductItem](
        items=items, page=q.page, page_size=q.page_size, total=len(ordered), total_pages=total_pages
    )


def _parse_list(value) -> list[str]:
    """Parse catalogue list strings like "['Vegan', 'Clean']" safely (literal_eval only)."""
    if value is None or pd.isna(value):
        return []
    try:
        parsed = ast.literal_eval(str(value))
    except (ValueError, SyntaxError):
        return [str(value)]
    if isinstance(parsed, (list, tuple)):
        return [str(v) for v in parsed]
    return [str(parsed)]


def get_product(ds: Dataset, product_id: str) -> ProductDetail | None:
    t = product_table(ds)
    rows = t[t["product_id"] == product_id]
    if rows.empty:
        return None
    row = rows.iloc[0]

    r = ds.reviews[(ds.reviews["product_id"] == product_id).to_numpy()]
    n, avg, five = rating_summary(r["rating"])
    rec_rate, _ = recommendation_rate(r["is_recommended"])
    stats = ProductReviewStats(
        review_record_count=n,
        average_rating=avg,
        five_star_share=five,
        recommendation_rate=rec_rate,
        rating_distribution=rating_buckets(r["rating"]),
        first_review_date=to_date(r["submission_time"].min()) if n else None,
        last_review_date=to_date(r["submission_time"].max()) if n else None,
    )
    return ProductDetail(
        **_product_item(row),
        brand_id=int(row["brand_id"]),
        size=none_if_na(row["size"]),
        variation_type=none_if_na(row["variation_type"]),
        variation_value=none_if_na(row["variation_value"]),
        value_price_usd=none_if_na(row["value_price_usd"]),
        child_count=int(row["child_count"]),
        highlights=_parse_list(row["highlights"]),
        ingredients=_parse_list(row["ingredients"]),
        review_stats=stats,
    )


class UnknownProductsError(LookupError):
    def __init__(self, missing: list[str]):
        super().__init__(", ".join(missing))
        self.missing = missing


def compare_products(ds: Dataset, q: ProductCompareQuery) -> ProductComparison:
    """Side-by-side figures for 2-4 products plus review activity on one shared period axis
    (first to last period across all of them, zero-filled)."""
    details = [get_product(ds, pid) for pid in q.product_id]
    missing = [pid for pid, d in zip(q.product_id, details, strict=True) if d is None]
    if missing:
        raise UnknownProductsError(missing)

    def compute() -> ProductComparison:
        items = [
            ComparedProduct(
                **d.model_dump(include=set(ProductItem.model_fields)),
                size=d.size,
                review_stats=d.review_stats,
            )
            for d in details
        ]
        r = ds.reviews[ds.reviews["product_id"].isin(q.product_id).to_numpy()]
        if r.empty:
            return ProductComparison(granularity=q.granularity, items=items, periods=[])
        keys = period_keys(
            r["year"].to_numpy(dtype=np.int64), r["month"].to_numpy(dtype=np.int64), q.granularity
        )
        base, size = int(keys.min()), int(keys.max() - keys.min()) + 1
        offs = keys - base
        pids = r["product_id"].astype(str).to_numpy()
        ratings = r["rating"].to_numpy(dtype=np.float64)
        counts, sums = [], []
        for pid in q.product_id:
            mask = pids == pid
            counts.append(np.bincount(offs[mask], minlength=size))
            sums.append(np.bincount(offs[mask], weights=ratings[mask], minlength=size))
        periods = []
        for i in range(size):
            label, start = period_label(base + i, q.granularity)
            periods.append(
                ComparisonPeriod(
                    period=label,
                    period_start=start,
                    review_counts=[int(c[i]) for c in counts],
                    average_ratings=[
                        r4(s_[i] / c[i]) if c[i] else None
                        for c, s_ in zip(counts, sums, strict=True)
                    ],
                )
            )
        return ProductComparison(granularity=q.granularity, items=items, periods=periods)

    return ds.memo(("compare", q.cache_key()), compute)
