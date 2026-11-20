/**
 * Typed mirrors of the FastAPI response models (backend/app/schemas/responses.py).
 *
 * Two review counts are never mixed:
 * - review_count / review_record_count: rows in the review CSV files (Skincare, deduplicated)
 * - sephora_review_count: Sephora's own catalogue figure from product_info.csv
 */

export interface HealthResponse {
  status: string;
  app: string;
  environment: string;
  dataset_available: boolean;
  dataset_loaded: boolean;
}

/** Part 1 summary contract (still served by /overview). */
export interface CatalogueSummary {
  total_products: number;
  total_brands: number;
  total_categories: number;
  sephora_listed_review_count: number;
}

export interface ReviewSummary {
  raw_review_count: number;
  duplicate_reviews_removed: number;
  review_count: number;
  reviewed_products: number;
  average_rating: number;
  five_star_share: number;
  first_review_date: string | null;
  last_review_date: string | null;
  review_scope_category: string | null;
}

export interface OverviewResponse {
  catalogue: CatalogueSummary;
  reviews: ReviewSummary;
}

// ------------------------------------------------------------------ KPIs
export interface CatalogueKpis {
  total_products: number;
  total_brands: number;
  total_categories: number;
  sephora_review_count: number;
  average_price_usd: number;
  median_price_usd: number;
}

export interface ReviewKpis {
  review_count: number;
  average_rating: number | null;
  five_star_share: number | null;
  recommendation_rate: number | null;
  recommendation_responses: number;
  unique_reviewers: number;
  reviewed_products: number;
  reviewed_brands: number;
  first_review_date: string | null;
  last_review_date: string | null;
}

export interface ExecutiveKpis {
  catalogue: CatalogueKpis;
  reviews: ReviewKpis;
  data_quality: {
    raw_review_count: number;
    duplicate_reviews_removed: number;
    review_records_total: number;
  };
  review_scope_category: string;
  filters_applied: boolean;
}

// ------------------------------------------------------------------ reviews
export interface RatingBucket {
  rating: number;
  count: number;
  share: number;
}

export interface RatingDistribution {
  total: number;
  average_rating: number | null;
  buckets: RatingBucket[];
}

export type Granularity = "month" | "quarter" | "year";

export interface TrendPoint {
  period: string;
  period_start: string;
  review_count: number;
  average_rating: number | null;
  five_star_share: number | null;
}

export interface ReviewTrend {
  granularity: Granularity;
  total: number;
  points: TrendPoint[];
}

export interface HeatmapCell {
  year: number;
  month: number;
  review_count: number;
}

export interface ActivityHeatmap {
  years: number[];
  months: number[];
  max_count: number;
  cells: HeatmapCell[];
}

// ------------------------------------------------------------------ products
export interface RankedProduct {
  rank: number;
  product_id: string;
  product_name: string;
  brand_name: string;
  subcategory: string | null;
  price_usd: number;
  review_count: number;
  average_rating: number;
  five_star_share: number;
}

export interface YearRanking {
  year: number;
  total_reviews_in_year: number;
  items: RankedProduct[];
}

export interface YearCount {
  year: number;
  review_count: number;
}

export interface PopularityPoint {
  product_id: string;
  product_name: string;
  brand_name: string;
  subcategory: string | null;
  price_usd: number;
  loves_count: number;
  review_count: number;
  average_rating: number;
}

export interface RatingPopularity {
  total_products: number;
  returned: number;
  points: PopularityPoint[];
}

// ------------------------------------------------------------------ brands
export interface RankedBrand {
  rank: number;
  brand_name: string;
  review_count: number;
  share: number;
  average_rating: number;
  reviewed_products: number;
}

export interface TopBrands {
  total_reviews: number;
  items: RankedBrand[];
}

// ------------------------------------------------------------------ categories
export interface CatalogueCategory {
  category: string;
  product_count: number;
  share_of_products: number;
  brand_count: number;
  average_price_usd: number;
  median_price_usd: number;
  average_catalogue_rating: number | null;
  sephora_review_count: number;
  loves_count: number;
}

export interface CatalogueCategories {
  level: "primary" | "secondary";
  parent: string | null;
  total_products: number;
  items: CatalogueCategory[];
}

export interface ReviewCategory {
  subcategory: string;
  review_count: number;
  share: number;
  average_rating: number;
  five_star_share: number;
  recommendation_rate: number | null;
  reviewed_products: number;
}

export interface ReviewCategories {
  scope_category: string;
  total_reviews: number;
  items: ReviewCategory[];
}

// ------------------------------------------------------------------ prices
export interface PriceBin {
  label: string;
  min_price: number;
  max_price: number | null;
  product_count: number;
}

export interface PriceDistribution {
  bin_width: number;
  max_price: number;
  stats: {
    count: number;
    min: number | null;
    p25: number | null;
    median: number | null;
    mean: number | null;
    p75: number | null;
    max: number | null;
  };
  bins: PriceBin[];
}

// ------------------------------------------------------------------ filters
export interface NamedCount {
  name: string;
  count: number;
}

export interface FilterOptions {
  catalogue: {
    primary_categories: NamedCount[];
    secondary_categories: Record<string, NamedCount[]>;
    brands: string[];
    price_min: number;
    price_max: number;
  };
  reviews: {
    scope_category: string;
    subcategories: NamedCount[];
    brands: NamedCount[];
    years: YearCount[];
    skin_types: string[];
    ratings: number[];
    date_min: string | null;
    date_max: string | null;
  };
}

/** Query parameters accepted by review-based endpoints (backend ReviewFilters). */
export interface ReviewFilterParams {
  date_from?: string;
  date_to?: string;
  brand?: string[];
  subcategory?: string[];
  product_id?: string[];
  rating?: number[];
  recommended?: boolean;
}

// ------------------------------------------------------------------ paging
export interface Page<T> {
  items: T[];
  page: number;
  page_size: number;
  /** Matching rows across all pages. */
  total: number;
  /** 0 when nothing matches. */
  total_pages: number;
}

export type SortOrder = "asc" | "desc";

// ------------------------------------------------------------------ catalogue products
/** Whitelisted sort fields of GET /products (backend ProductSortField). */
export type ProductSortField =
  | "product_name"
  | "brand_name"
  | "price_usd"
  | "catalogue_rating"
  | "loves_count"
  | "sephora_review_count"
  | "review_record_count"
  | "review_average_rating";

export interface ProductListParams {
  q?: string;
  primary_category?: string[];
  secondary_category?: string[];
  brand?: string[];
  price_min?: number;
  price_max?: number;
  min_catalogue_rating?: number;
  sort_by?: ProductSortField;
  order?: SortOrder;
  page?: number;
  page_size?: number;
}

export interface ProductItem {
  product_id: string;
  product_name: string;
  brand_name: string;
  primary_category: string;
  secondary_category: string | null;
  tertiary_category: string | null;
  price_usd: number;
  sale_price_usd: number | null;
  loves_count: number;
  /** Sephora's catalogue rating (all categories). */
  catalogue_rating: number | null;
  /** Sephora's catalogue review count — NOT review records. */
  sephora_review_count: number | null;
  /** Rows in the review CSV files (Skincare only). */
  review_record_count: number;
  /** Mean rating of the review CSV rows. */
  review_average_rating: number | null;
  new: boolean;
  limited_edition: boolean;
  sephora_exclusive: boolean;
  online_only: boolean;
  out_of_stock: boolean;
}

export interface ProductReviewStats {
  review_record_count: number;
  average_rating: number | null;
  five_star_share: number | null;
  recommendation_rate: number | null;
  rating_distribution: RatingBucket[];
  first_review_date: string | null;
  last_review_date: string | null;
}

export interface ProductDetail extends ProductItem {
  brand_id: number;
  size: string | null;
  variation_type: string | null;
  variation_value: string | null;
  value_price_usd: number | null;
  child_count: number;
  highlights: string[];
  ingredients: string[];
  review_stats: ProductReviewStats;
}

// ------------------------------------------------------------------ review records
/** Whitelisted sort fields of GET /reviews (backend ReviewSortField). */
export type ReviewSortField =
  | "submission_time"
  | "rating"
  | "helpfulness"
  | "total_feedback_count"
  | "total_pos_feedback_count";

export interface ReviewListParams extends ReviewFilterParams {
  q?: string;
  sort_by?: ReviewSortField;
  order?: SortOrder;
  page?: number;
  page_size?: number;
}

/** One review record. The reviewer's author_id is never exposed by the API. */
export interface ReviewItem {
  review_id: string;
  product_id: string;
  product_name: string;
  brand_name: string;
  subcategory: string | null;
  rating: number;
  is_recommended: boolean | null;
  helpfulness: number | null;
  total_feedback_count: number;
  total_pos_feedback_count: number;
  total_neg_feedback_count: number;
  submission_date: string;
  review_title: string | null;
  review_text: string | null;
  skin_tone: string | null;
  skin_type: string | null;
  eye_color: string | null;
  hair_color: string | null;
}

// ------------------------------------------------------------------ reviewer profiles
export type ProfileDimensionName = "skin_type" | "skin_tone" | "eye_color" | "hair_color";

export interface ProfileSegment {
  value: string;
  review_count: number;
  /** Share among reviews that answered this attribute. */
  share: number;
  average_rating: number;
  five_star_share: number;
  recommendation_rate: number | null;
}

export interface ProfileDimension {
  dimension: ProfileDimensionName;
  answered: number;
  missing: number;
  segments: ProfileSegment[];
}

/** Aggregate, self-reported reviewer attributes (GET /reviews/profiles). */
export interface ReviewerProfiles {
  total_reviews: number;
  dimensions: ProfileDimension[];
}
