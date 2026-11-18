"""Executive KPIs."""

from __future__ import annotations

import pandas as pd

from app.data.dataset import Dataset
from app.schemas.queries import ReviewFilters
from app.schemas.responses import CatalogueKpis, DataQuality, ExecutiveKpis, ReviewKpis
from app.services.common import (
    REVIEW_SCOPE_CATEGORY,
    filtered_reviews,
    r4,
    rating_summary,
    recommendation_rate,
    to_date,
)


def catalogue_kpis(ds: Dataset) -> CatalogueKpis:
    def compute() -> CatalogueKpis:
        p = ds.products
        return CatalogueKpis(
            total_products=int(p["product_id"].nunique()),
            total_brands=int(p["brand_name"].nunique()),
            total_categories=int(p["primary_category"].nunique()),
            sephora_review_count=int(p["sephora_review_count"].fillna(0).sum()),
            average_price_usd=r4(p["price_usd"].mean()),
            median_price_usd=r4(p["price_usd"].median()),
        )

    return ds.memo("catalogue_kpis", compute)


def executive_kpis(ds: Dataset, f: ReviewFilters) -> ExecutiveKpis:
    def compute() -> ExecutiveKpis:
        r = filtered_reviews(ds, f)
        n, avg, five = rating_summary(r["rating"])
        rec_rate, rec_n = recommendation_rate(r["is_recommended"])
        return ExecutiveKpis(
            catalogue=catalogue_kpis(ds),
            reviews=ReviewKpis(
                review_count=n,
                average_rating=avg,
                five_star_share=five,
                recommendation_rate=rec_rate,
                recommendation_responses=rec_n,
                unique_reviewers=int(len(pd.unique(r["author_key"].to_numpy()))),
                reviewed_products=int(r["product_id"].nunique()),
                reviewed_brands=int(r["brand_name"].nunique()),
                first_review_date=to_date(r["submission_time"].min()) if n else None,
                last_review_date=to_date(r["submission_time"].max()) if n else None,
            ),
            data_quality=DataQuality(
                raw_review_count=ds.raw_review_count,
                duplicate_reviews_removed=ds.duplicate_reviews_removed,
                review_records_total=len(ds.reviews),
            ),
            review_scope_category=REVIEW_SCOPE_CATEGORY,
            filters_applied=f.has_review_filters,
        )

    return ds.memo(("kpis", f.review_filters_key()), compute)
