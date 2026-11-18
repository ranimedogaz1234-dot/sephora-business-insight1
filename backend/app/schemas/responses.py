"""Response models (the typed API contract mirrored in frontend/src/lib/api/types.ts).

Naming convention for review counts — never mixed:
* ``review_count`` / ``review_record_count``: rows in the review CSV files (deduplicated).
* ``sephora_review_count``: Sephora's own catalogue figure from product_info.csv.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class Page[T](BaseModel):
    items: list[T]
    page: int
    page_size: int
    total: int
    total_pages: int


# --------------------------------------------------------------------------- KPIs
class CatalogueKpis(BaseModel):
    """product_info.csv — all nine categories; not affected by review filters."""

    total_products: int
    total_brands: int
    total_categories: int
    sephora_review_count: int = Field(
        description="Sum of Sephora's catalogue 'reviews' column — NOT review records."
    )
    average_price_usd: float
    median_price_usd: float


class ReviewKpis(BaseModel):
    """Computed from the deduplicated review CSV records (Skincare)."""

    review_count: int
    average_rating: float | None
    five_star_share: float | None
    recommendation_rate: float | None = Field(
        description="Share recommending, among reviews that answered (is_recommended not null)"
    )
    recommendation_responses: int
    unique_reviewers: int
    reviewed_products: int
    reviewed_brands: int
    first_review_date: date | None
    last_review_date: date | None


class DataQuality(BaseModel):
    raw_review_count: int
    duplicate_reviews_removed: int
    review_records_total: int


class ExecutiveKpis(BaseModel):
    catalogue: CatalogueKpis
    reviews: ReviewKpis
    data_quality: DataQuality
    review_scope_category: str
    filters_applied: bool


# --------------------------------------------------------------------------- reviews
class RatingBucket(BaseModel):
    rating: int
    count: int
    share: float


class RatingDistribution(BaseModel):
    total: int
    average_rating: float | None
    buckets: list[RatingBucket]


class TrendPoint(BaseModel):
    period: str
    period_start: date
    review_count: int
    average_rating: float | None
    five_star_share: float | None


class ReviewTrend(BaseModel):
    granularity: Literal["month", "quarter", "year"]
    total: int
    points: list[TrendPoint]


class HeatmapCell(BaseModel):
    year: int
    month: int
    review_count: int


class ActivityHeatmap(BaseModel):
    years: list[int]
    months: list[int]
    max_count: int
    cells: list[HeatmapCell]


class ReviewItem(BaseModel):
    """A single review. The reviewer's author_id is deliberately never exposed."""

    review_id: str
    product_id: str
    product_name: str
    brand_name: str
    subcategory: str | None
    rating: int
    is_recommended: bool | None
    helpfulness: float | None
    total_feedback_count: int
    total_pos_feedback_count: int
    total_neg_feedback_count: int
    submission_date: date
    review_title: str | None
    review_text: str | None
    skin_tone: str | None
    skin_type: str | None
    eye_color: str | None
    hair_color: str | None


# --------------------------------------------------------------------------- products
class RankedProduct(BaseModel):
    rank: int
    product_id: str
    product_name: str
    brand_name: str
    subcategory: str | None
    price_usd: float
    review_count: int
    average_rating: float
    five_star_share: float


class YearRanking(BaseModel):
    year: int
    total_reviews_in_year: int
    items: list[RankedProduct]


class YearCount(BaseModel):
    year: int
    review_count: int


class ProductItem(BaseModel):
    product_id: str
    product_name: str
    brand_name: str
    primary_category: str
    secondary_category: str | None
    tertiary_category: str | None
    price_usd: float
    sale_price_usd: float | None
    loves_count: int
    catalogue_rating: float | None = Field(description="Sephora's catalogue rating")
    sephora_review_count: int | None = Field(description="Sephora's catalogue review count")
    review_record_count: int = Field(description="Rows in the review CSV files")
    review_average_rating: float | None = Field(description="Mean of review CSV ratings")
    new: bool
    limited_edition: bool
    sephora_exclusive: bool
    online_only: bool
    out_of_stock: bool


class ProductReviewStats(BaseModel):
    review_record_count: int
    average_rating: float | None
    five_star_share: float | None
    recommendation_rate: float | None
    rating_distribution: list[RatingBucket]
    first_review_date: date | None
    last_review_date: date | None


class ProductDetail(ProductItem):
    brand_id: int
    size: str | None
    variation_type: str | None
    variation_value: str | None
    value_price_usd: float | None
    child_count: int
    highlights: list[str]
    ingredients: list[str]
    review_stats: ProductReviewStats


class PopularityPoint(BaseModel):
    product_id: str
    product_name: str
    brand_name: str
    subcategory: str | None
    price_usd: float
    loves_count: int
    review_count: int
    average_rating: float


class RatingPopularity(BaseModel):
    total_products: int
    returned: int
    points: list[PopularityPoint]


# --------------------------------------------------------------------------- brands
class BrandItem(BaseModel):
    brand_name: str
    product_count: int
    category_count: int
    average_price_usd: float
    loves_count: int
    sephora_review_count: int
    review_record_count: int
    review_average_rating: float | None


class RankedBrand(BaseModel):
    rank: int
    brand_name: str
    review_count: int
    share: float
    average_rating: float
    reviewed_products: int


class TopBrands(BaseModel):
    total_reviews: int
    items: list[RankedBrand]


# --------------------------------------------------------------------------- categories
class CatalogueCategory(BaseModel):
    category: str
    product_count: int
    share_of_products: float
    brand_count: int
    average_price_usd: float
    median_price_usd: float
    average_catalogue_rating: float | None
    sephora_review_count: int
    loves_count: int


class CatalogueCategories(BaseModel):
    level: Literal["primary", "secondary"]
    parent: str | None
    total_products: int
    items: list[CatalogueCategory]


class ReviewCategory(BaseModel):
    subcategory: str
    review_count: int
    share: float
    average_rating: float
    five_star_share: float
    recommendation_rate: float | None
    reviewed_products: int


class ReviewCategories(BaseModel):
    scope_category: str
    total_reviews: int
    items: list[ReviewCategory]


# --------------------------------------------------------------------------- prices
class PriceBin(BaseModel):
    label: str
    min_price: float
    max_price: float | None = Field(description="Exclusive upper bound; null for the last bin")
    product_count: int


class PriceStats(BaseModel):
    count: int
    min: float | None
    p25: float | None
    median: float | None
    mean: float | None
    p75: float | None
    max: float | None


class PriceDistribution(BaseModel):
    bin_width: int
    max_price: int
    stats: PriceStats
    bins: list[PriceBin]


# --------------------------------------------------------------------------- filters
class NamedCount(BaseModel):
    name: str
    count: int


class CatalogueOptions(BaseModel):
    primary_categories: list[NamedCount]
    secondary_categories: dict[str, list[NamedCount]]
    brands: list[str]
    price_min: float
    price_max: float


class ReviewOptions(BaseModel):
    scope_category: str
    subcategories: list[NamedCount]
    brands: list[NamedCount]
    years: list[YearCount]
    skin_types: list[str]
    ratings: list[int]
    date_min: date | None
    date_max: date | None


class FilterOptions(BaseModel):
    catalogue: CatalogueOptions
    reviews: ReviewOptions
