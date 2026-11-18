"""Dataset-level KPIs. Every figure is computed from the CSV records."""

from __future__ import annotations

import pandas as pd

from app.data.loader import Dataset
from app.schemas.overview import CatalogueSummary, OverviewResponse, ReviewSummary


def _to_date(value: pd.Timestamp):
    return None if pd.isna(value) else value.date()


def build_overview(ds: Dataset) -> OverviewResponse:
    products = ds.products
    reviews = ds.reviews

    catalogue = CatalogueSummary(
        total_products=int(products["product_id"].nunique()),
        total_brands=int(products["brand_name"].nunique()),
        total_categories=int(products["primary_category"].nunique()),
        sephora_listed_review_count=int(products["reviews"].fillna(0).sum()),
    )

    reviewed_ids = reviews["product_id"].dropna().unique()
    scope = products.loc[products["product_id"].isin(reviewed_ids), "primary_category"]
    scope_values = scope.dropna().unique()
    review_scope = str(scope_values[0]) if len(scope_values) == 1 else None

    ratings = reviews["rating"]
    summary = ReviewSummary(
        raw_review_count=ds.raw_review_count,
        duplicate_reviews_removed=ds.duplicate_reviews_removed,
        review_count=len(reviews),
        reviewed_products=int(len(reviewed_ids)),
        average_rating=round(float(ratings.mean()), 4) if len(ratings) else 0.0,
        five_star_share=round(float((ratings == 5).mean()), 4) if len(ratings) else 0.0,
        first_review_date=_to_date(reviews["submission_time"].min()),
        last_review_date=_to_date(reviews["submission_time"].max()),
        review_scope_category=review_scope,
    )
    return OverviewResponse(catalogue=catalogue, reviews=summary)
