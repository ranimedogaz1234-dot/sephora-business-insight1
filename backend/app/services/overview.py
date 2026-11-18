"""Dataset-level summary used by the setup/overview page. Every figure is computed
from the CSV records (via the prepared dataset)."""

from __future__ import annotations

from app.data.dataset import Dataset
from app.schemas.overview import CatalogueSummary, OverviewResponse, ReviewSummary
from app.services.common import rating_summary, to_date


def build_overview(ds: Dataset) -> OverviewResponse:
    def compute() -> OverviewResponse:
        products, reviews = ds.products, ds.reviews

        reviewed_ids = reviews["product_id"].dropna().unique()
        scope = products.loc[products["product_id"].isin(reviewed_ids), "primary_category"]
        scope_values = scope.dropna().unique()
        n, avg, five = rating_summary(reviews["rating"])

        return OverviewResponse(
            catalogue=CatalogueSummary(
                total_products=int(products["product_id"].nunique()),
                total_brands=int(products["brand_name"].nunique()),
                total_categories=int(products["primary_category"].nunique()),
                sephora_listed_review_count=int(products["sephora_review_count"].fillna(0).sum()),
            ),
            reviews=ReviewSummary(
                raw_review_count=ds.raw_review_count,
                duplicate_reviews_removed=ds.duplicate_reviews_removed,
                review_count=n,
                reviewed_products=int(len(reviewed_ids)),
                average_rating=avg or 0.0,
                five_star_share=five or 0.0,
                first_review_date=to_date(reviews["submission_time"].min()) if n else None,
                last_review_date=to_date(reviews["submission_time"].max()) if n else None,
                review_scope_category=str(scope_values[0]) if len(scope_values) == 1 else None,
            ),
        )

    return ds.memo("overview", compute)
