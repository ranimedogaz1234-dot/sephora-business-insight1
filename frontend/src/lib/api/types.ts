/** Typed mirrors of the FastAPI response models (backend/app/schemas). */

export interface HealthResponse {
  status: string;
  app: string;
  environment: string;
  dataset_available: boolean;
  dataset_loaded: boolean;
}

/** Figures from product_info.csv — all nine catalogue categories. */
export interface CatalogueSummary {
  total_products: number;
  total_brands: number;
  total_categories: number;
  /** Sephora's own listed count — NOT the number of review records. */
  sephora_listed_review_count: number;
}

/** Figures computed from the review CSV records (Skincare only). */
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
