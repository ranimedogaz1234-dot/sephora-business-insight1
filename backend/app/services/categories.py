"""Category analytics.

* Catalogue analytics use product_info.csv and cover all nine primary categories.
* Review analytics use the review records, which only cover Skincare products, so
  they are broken down by Skincare subcategory (catalogue ``secondary_category``).
"""

from __future__ import annotations

import pandas as pd

from app.data.dataset import Dataset
from app.schemas.queries import CatalogueCategoryQuery, ReviewFilters
from app.schemas.responses import (
    CatalogueCategories,
    CatalogueCategory,
    ReviewCategories,
    ReviewCategory,
)
from app.services.common import REVIEW_SCOPE_CATEGORY, filtered_reviews, group_stats, r4, rank

UNSPECIFIED = "Unspecified"


class UnknownCategoryError(LookupError):
    pass


def primary_categories(ds: Dataset) -> list[str]:
    return sorted(ds.products["primary_category"].dropna().astype(str).unique())


def catalogue_categories(ds: Dataset, q: CatalogueCategoryQuery) -> CatalogueCategories:
    if q.parent is not None and q.parent not in primary_categories(ds):
        raise UnknownCategoryError(q.parent)

    def compute() -> CatalogueCategories:
        p = ds.products
        if q.parent is None:
            level, key = "primary", p["primary_category"].astype(str)
        else:
            p = p[(p["primary_category"] == q.parent).to_numpy()]
            level, key = "secondary", p["secondary_category"].astype("string").fillna(UNSPECIFIED)
        g = p.groupby(key.to_numpy())
        t = pd.DataFrame(
            {
                "product_count": g.size(),
                "brand_count": g["brand_name"].nunique(),
                "average_price": g["price_usd"].mean(),
                "median_price": g["price_usd"].median(),
                "average_catalogue_rating": g["catalogue_rating"].mean(),
                "sephora_review_count": g["sephora_review_count"].sum(),
                "loves_count": g["loves_count"].sum(),
            }
        )
        t = t.rename_axis("category").reset_index()
        t = t.sort_values(["product_count", "category"], ascending=[False, True], kind="mergesort")
        total = int(len(p))
        return CatalogueCategories(
            level=level,
            parent=q.parent,
            total_products=total,
            items=[
                CatalogueCategory(
                    category=str(row["category"]),
                    product_count=int(row["product_count"]),
                    share_of_products=r4(row["product_count"] / total),
                    brand_count=int(row["brand_count"]),
                    average_price_usd=r4(row["average_price"]),
                    median_price_usd=r4(row["median_price"]),
                    average_catalogue_rating=r4(row["average_catalogue_rating"]),
                    sephora_review_count=int(row["sephora_review_count"]),
                    loves_count=int(row["loves_count"]),
                )
                for _, row in t.iterrows()
            ],
        )

    return ds.memo(("catalogue_categories", q.cache_key()), compute)


def review_categories(ds: Dataset, f: ReviewFilters) -> ReviewCategories:
    def compute() -> ReviewCategories:
        r = filtered_reviews(ds, f)
        stats = rank(group_stats(r, "subcategory"), "subcategory")
        total = len(r)
        return ReviewCategories(
            scope_category=REVIEW_SCOPE_CATEGORY,
            total_reviews=total,
            items=[
                ReviewCategory(
                    subcategory=row["subcategory"],
                    review_count=int(row["review_count"]),
                    share=r4(row["review_count"] / total),
                    average_rating=r4(row["average_rating"]),
                    five_star_share=r4(row["five_star_share"]),
                    recommendation_rate=r4(row["recommendation_rate"]),
                    reviewed_products=int(row["reviewed_products"]),
                )
                for _, row in stats.iterrows()
            ],
        )

    return ds.memo(("review_categories", f.review_filters_key()), compute)
