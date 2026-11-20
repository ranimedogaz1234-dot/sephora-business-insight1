"""Validated query-parameter models.

Each endpoint takes exactly one model (``Annotated[Model, Query()]``). Unknown
parameters are rejected (``extra="forbid"``), list sizes and string lengths are
bounded, and sort fields are whitelisted, so user input can never reach pandas
as a column name, regex or unbounded workload.
"""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Text120 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
SearchText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=100)]
ProductId = Annotated[str, StringConstraints(pattern=r"^P\d{1,12}$")]
Rating = Annotated[int, Field(ge=1, le=5)]
Order = Literal["asc", "desc"]

MAX_LIST = 50


class QueryModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    def cache_key(self) -> str:
        return f"{type(self).__name__}:{self.model_dump_json()}"


def _normalise(values: list) -> list:
    return sorted(set(values))


class PageParams(QueryModel):
    page: int = Field(1, ge=1, le=100_000)
    page_size: int = Field(20, ge=1, le=100)


class ReviewFilters(QueryModel):
    """Filters over the review CSV records (Skincare products)."""

    date_from: date | None = Field(None, description="Inclusive start date (YYYY-MM-DD)")
    date_to: date | None = Field(None, description="Inclusive end date (YYYY-MM-DD)")
    brand: list[Text120] = Field(default_factory=list, max_length=MAX_LIST)
    subcategory: list[Text120] = Field(
        default_factory=list, max_length=MAX_LIST, description="Skincare subcategory"
    )
    product_id: list[ProductId] = Field(default_factory=list, max_length=MAX_LIST)
    rating: list[Rating] = Field(default_factory=list, max_length=5)
    recommended: bool | None = None
    skin_type: list[Text120] = Field(default_factory=list, max_length=MAX_LIST)

    @model_validator(mode="after")
    def _check(self) -> Self:
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from must be on or before date_to")
        for name in ("brand", "subcategory", "product_id", "rating", "skin_type"):
            object.__setattr__(self, name, _normalise(getattr(self, name)))
        return self

    @property
    def has_review_filters(self) -> bool:
        """True if any review filter (not paging/sorting/limits) is set."""
        names = set(ReviewFilters.model_fields)
        return self.model_dump(include=names) != ReviewFilters().model_dump()

    def review_filters_key(self) -> str:
        """Cache key covering only the review filters (shared across endpoints)."""
        return ReviewFilters(**self.model_dump(include=set(ReviewFilters.model_fields))).cache_key()


class TrendQuery(ReviewFilters):
    granularity: Literal["month", "quarter", "year"] = "month"


class TopProductsQuery(ReviewFilters):
    limit: int = Field(10, ge=1, le=50)


class TopProductsByYearQuery(ReviewFilters):
    year: int = Field(..., ge=1990, le=2100)
    limit: int = Field(10, ge=1, le=50)


class RatingPopularityQuery(ReviewFilters):
    min_reviews: int = Field(1, ge=1, le=100_000)
    limit: int = Field(500, ge=1, le=3000)


class TopBrandsQuery(ReviewFilters):
    limit: int = Field(10, ge=1, le=50)


BrandReviewSortField = Literal[
    "review_count", "average_rating", "five_star_share", "recommendation_rate"
]


class BrandReviewStatsQuery(ReviewFilters):
    """Per-brand review statistics; ``min_reviews`` keeps small samples out of rate rankings."""

    min_reviews: int = Field(1, ge=1, le=1_000_000)
    sort_by: BrandReviewSortField = "review_count"
    order: Order = "desc"
    limit: int = Field(50, ge=1, le=500)


class BrandDetailQuery(QueryModel):
    brand: Text120


ReviewSortField = Literal[
    "submission_time",
    "rating",
    "helpfulness",
    "total_feedback_count",
    "total_pos_feedback_count",
]


class ReviewListQuery(ReviewFilters, PageParams):
    q: SearchText | None = Field(None, description="Case-insensitive text search in title/text")
    sort_by: ReviewSortField = "submission_time"
    order: Order = "desc"


ProductSortField = Literal[
    "product_name",
    "brand_name",
    "price_usd",
    "catalogue_rating",
    "loves_count",
    "sephora_review_count",
    "review_record_count",
    "review_average_rating",
]


class ProductListQuery(PageParams):
    """Filters over the product catalogue (all nine categories)."""

    q: SearchText | None = Field(None, description="Case-insensitive search in name or brand")
    primary_category: list[Text120] = Field(default_factory=list, max_length=MAX_LIST)
    secondary_category: list[Text120] = Field(default_factory=list, max_length=MAX_LIST)
    brand: list[Text120] = Field(default_factory=list, max_length=MAX_LIST)
    price_min: float | None = Field(None, ge=0, le=100_000)
    price_max: float | None = Field(None, ge=0, le=100_000)
    min_catalogue_rating: float | None = Field(None, ge=0, le=5)
    has_review_records: bool | None = None
    new: bool | None = None
    limited_edition: bool | None = None
    sephora_exclusive: bool | None = None
    online_only: bool | None = None
    out_of_stock: bool | None = None
    sort_by: ProductSortField = "loves_count"
    order: Order = "desc"

    @model_validator(mode="after")
    def _check(self) -> Self:
        if self.price_min is not None and self.price_max is not None:
            if self.price_min > self.price_max:
                raise ValueError("price_min must be less than or equal to price_max")
        for name in ("primary_category", "secondary_category", "brand"):
            object.__setattr__(self, name, _normalise(getattr(self, name)))
        return self


BrandSortField = Literal[
    "brand_name",
    "product_count",
    "average_price",
    "loves_count",
    "sephora_review_count",
    "review_record_count",
    "review_average_rating",
]


class BrandListQuery(PageParams):
    q: SearchText | None = None
    sort_by: BrandSortField = "review_record_count"
    order: Order = "desc"


class CatalogueCategoryQuery(QueryModel):
    parent: Text120 | None = Field(
        None, description="Primary category to drill into (returns its secondary categories)"
    )
    brand: Text120 | None = Field(None, description="Limit the breakdown to one catalogue brand")


class PriceDistributionQuery(QueryModel):
    primary_category: list[Text120] = Field(default_factory=list, max_length=MAX_LIST)
    bin_width: int = Field(10, ge=1, le=500)
    max_price: int = Field(300, ge=10, le=5000, description="Prices >= max_price share one bin")

    @model_validator(mode="after")
    def _check(self) -> Self:
        if self.max_price / self.bin_width > 200:
            raise ValueError("too many bins: increase bin_width or lower max_price")
        object.__setattr__(self, "primary_category", _normalise(self.primary_category))
        return self
