from datetime import date

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    app: str
    environment: str
    dataset_available: bool
    dataset_loaded: bool


class CatalogueSummary(BaseModel):
    """Figures from product_info.csv (all nine catalogue categories)."""

    total_products: int
    total_brands: int
    total_categories: int
    sephora_listed_review_count: int = Field(
        description="Sum of the 'reviews' column in product_info.csv — Sephora's own "
        "catalogue count, NOT the number of review records in the review CSVs."
    )


class ReviewSummary(BaseModel):
    """Figures computed from the actual review CSV records (Skincare only)."""

    raw_review_count: int
    duplicate_reviews_removed: int
    review_count: int
    reviewed_products: int
    average_rating: float
    five_star_share: float
    first_review_date: date | None
    last_review_date: date | None
    review_scope_category: str | None


class OverviewResponse(BaseModel):
    catalogue: CatalogueSummary
    reviews: ReviewSummary
