"""Analytics endpoints: KPIs, reviews, products, brands, categories, prices."""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, status

from app.api.deps import DatasetDep
from app.schemas.queries import (
    BrandDetailQuery,
    BrandListQuery,
    BrandReviewStatsQuery,
    CatalogueCategoryQuery,
    PriceDistributionQuery,
    ProductCompareQuery,
    ProductListQuery,
    RatingPopularityQuery,
    ReviewFilters,
    ReviewListQuery,
    TopBrandsQuery,
    TopProductsByYearQuery,
    TopProductsQuery,
    TrendQuery,
)
from app.schemas.responses import (
    ActivityHeatmap,
    BrandItem,
    BrandReviewStats,
    CatalogueCategories,
    ExecutiveKpis,
    Page,
    PriceDistribution,
    ProductComparison,
    ProductDetail,
    ProductItem,
    RankedProduct,
    RatingDistribution,
    RatingPopularity,
    ReviewCategories,
    ReviewerProfiles,
    ReviewItem,
    ReviewTrend,
    TopBrands,
    YearCount,
    YearRanking,
)
from app.services import brands, categories, kpis, prices, products, reviews

ReviewIdPath = Annotated[str, Path(pattern=r"^r_[0-9a-f]{16}$")]
ProductIdPath = Annotated[str, Path(pattern=r"^P\d{1,12}$")]

kpi_router = APIRouter(prefix="/kpis", tags=["kpis"])
review_router = APIRouter(prefix="/reviews", tags=["reviews"])
product_router = APIRouter(prefix="/products", tags=["products"])
brand_router = APIRouter(prefix="/brands", tags=["brands"])
category_router = APIRouter(prefix="/categories", tags=["categories"])
price_router = APIRouter(prefix="/prices", tags=["prices"])


# ----------------------------------------------------------------------------- KPIs
@kpi_router.get("", response_model=ExecutiveKpis)
def executive_kpis(ds: DatasetDep, f: Annotated[ReviewFilters, Query()]) -> ExecutiveKpis:
    """Executive KPIs. Review figures honour the filters; catalogue figures never do."""
    return kpis.executive_kpis(ds, f)


# ----------------------------------------------------------------------------- reviews
@review_router.get("/rating-distribution", response_model=RatingDistribution)
def rating_distribution(ds: DatasetDep, f: Annotated[ReviewFilters, Query()]):
    return reviews.rating_distribution(ds, f)


@review_router.get("/trends", response_model=ReviewTrend)
def review_trends(ds: DatasetDep, q: Annotated[TrendQuery, Query()]):
    """Review volume and average rating per month/quarter/year (gaps zero-filled)."""
    return reviews.review_trend(ds, q)


@review_router.get("/activity-heatmap", response_model=ActivityHeatmap)
def activity_heatmap(ds: DatasetDep, f: Annotated[ReviewFilters, Query()]):
    return reviews.activity_heatmap(ds, f)


@review_router.get("/profiles", response_model=ReviewerProfiles)
def reviewer_profiles(ds: DatasetDep, f: Annotated[ReviewFilters, Query()]):
    """Review counts and ratings by self-reported skin type, skin tone, eye and hair colour.

    Aggregates only: individual reviewers and their attributes are never returned.
    """
    return reviews.reviewer_profiles(ds, f)


@review_router.get("", response_model=Page[ReviewItem])
def list_reviews(ds: DatasetDep, q: Annotated[ReviewListQuery, Query()]):
    """Review explorer: filter, literal text search, sort and paginate review records."""
    return reviews.list_reviews(ds, q)


@review_router.get("/{review_id}", response_model=ReviewItem)
def get_review(ds: DatasetDep, review_id: ReviewIdPath):
    item = reviews.get_review(ds, review_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    return item


# ----------------------------------------------------------------------------- products
@product_router.get("/top-reviewed", response_model=list[RankedProduct])
def top_reviewed(ds: DatasetDep, q: Annotated[TopProductsQuery, Query()]):
    """Most reviewed products by review-record count (ties: product_id ascending)."""
    return products.top_reviewed_products(ds, q)


@product_router.get("/top-by-year", response_model=YearRanking)
def top_by_year(ds: DatasetDep, q: Annotated[TopProductsByYearQuery, Query()]):
    """Most reviewed products within one calendar year."""
    return products.top_products_by_year(ds, q)


@product_router.get("/review-years", response_model=list[YearCount])
def review_years(ds: DatasetDep):
    """Years that have review records (for the year selector)."""
    return products.review_years(ds)


@product_router.get("/rating-popularity", response_model=RatingPopularity)
def rating_popularity(ds: DatasetDep, q: Annotated[RatingPopularityQuery, Query()]):
    """Per-product average rating vs review volume and loves (scatter plot data)."""
    return products.rating_popularity(ds, q)


@product_router.get("/compare", response_model=ProductComparison)
def compare_products(ds: DatasetDep, q: Annotated[ProductCompareQuery, Query()]):
    """Compare 2-4 products: catalogue facts, review statistics and review activity per period."""
    try:
        return products.compare_products(ds, q)
    except products.UnknownProductsError as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, f"Product not found: {', '.join(exc.missing)}"
        ) from exc


@product_router.get("", response_model=Page[ProductItem])
def list_products(ds: DatasetDep, q: Annotated[ProductListQuery, Query()]):
    """Product catalogue (all nine categories) with search, filters, sorting and paging."""
    return products.list_products(ds, q)


@product_router.get("/{product_id}", response_model=ProductDetail)
def get_product(ds: DatasetDep, product_id: ProductIdPath):
    item = products.get_product(ds, product_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Product not found")
    return item


# ----------------------------------------------------------------------------- brands
@brand_router.get("", response_model=Page[BrandItem])
def list_brands(ds: DatasetDep, q: Annotated[BrandListQuery, Query()]):
    """All catalogue brands with catalogue figures and (separately) review-record figures."""
    return brands.list_brands(ds, q)


@brand_router.get("/detail", response_model=BrandItem)
def brand_detail(ds: DatasetDep, q: Annotated[BrandDetailQuery, Query()]):
    """One brand by exact name (query parameter, so names with any characters are safe)."""
    item = brands.get_brand(ds, q.brand)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Brand not found")
    return item


@brand_router.get("/review-stats", response_model=BrandReviewStats)
def brand_review_stats(ds: DatasetDep, q: Annotated[BrandReviewStatsQuery, Query()]):
    """Per-brand review statistics with a minimum review count and a whitelisted sort."""
    return brands.brand_review_stats(ds, q)


@brand_router.get("/top", response_model=TopBrands)
def top_brands(ds: DatasetDep, q: Annotated[TopBrandsQuery, Query()]):
    """Top brands by review-record volume."""
    return brands.top_brands(ds, q)


# ----------------------------------------------------------------------------- categories
@category_router.get("/catalogue", response_model=CatalogueCategories)
def catalogue_categories(ds: DatasetDep, q: Annotated[CatalogueCategoryQuery, Query()]):
    """Catalogue breakdown across all nine primary categories (or one category's subcategories)."""
    try:
        return categories.catalogue_categories(ds, q)
    except categories.UnknownCategoryError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown primary category") from exc
    except categories.UnknownBrandError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown brand") from exc


@category_router.get("/reviews", response_model=ReviewCategories)
def review_categories(ds: DatasetDep, f: Annotated[ReviewFilters, Query()]):
    """Review-record breakdown by Skincare subcategory."""
    return categories.review_categories(ds, f)


# ----------------------------------------------------------------------------- prices
@price_router.get("/distribution", response_model=PriceDistribution)
def price_distribution(ds: DatasetDep, q: Annotated[PriceDistributionQuery, Query()]):
    """Catalogue price histogram with an overflow bin and summary statistics."""
    return prices.price_distribution(ds, q)


routers = [kpi_router, review_router, product_router, brand_router, category_router, price_router]
