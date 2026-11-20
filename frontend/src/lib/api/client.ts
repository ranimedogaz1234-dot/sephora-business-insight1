import { config } from "@/lib/config";
import type {
  ActivityHeatmap,
  BrandItem,
  BrandListParams,
  BrandReviewSortField,
  BrandReviewStats,
  CatalogueCategories,
  ExecutiveKpis,
  FilterOptions,
  HealthResponse,
  OverviewResponse,
  Page,
  PriceDistribution,
  ProductComparison,
  ProductDetail,
  ProductItem,
  ProductListParams,
  ReviewItem,
  ReviewListParams,
  RankedProduct,
  RatingDistribution,
  ReviewerProfiles,
  RatingPopularity,
  ReviewCategories,
  ReviewFilterParams,
  ReviewTrend,
  SortOrder,
  TopBrands,
  YearRanking,
} from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type QueryValue = string | number | boolean | undefined | null | readonly (string | number)[];
export type Query = Record<string, QueryValue>;

/** Build a query string; arrays repeat the key (?brand=A&brand=B), empty values are dropped. */
export function toQueryString(query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, String(v));
    } else {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function apiGet<T>(path: string, query?: Query, init?: RequestInit): Promise<T> {
  const url = `${config.apiBaseUrl}${config.apiPrefix}${path}${toQueryString(query)}`;
  const res = await fetch(url, { cache: "no-store", ...init });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail || `Request failed: ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

type F = ReviewFilterParams;

export const api = {
  health: () => apiGet<HealthResponse>("/health"),
  overview: () => apiGet<OverviewResponse>("/overview"),
  filters: () => apiGet<FilterOptions>("/filters"),
  kpis: (f: F = {}) => apiGet<ExecutiveKpis>("/kpis", { ...f }),
  ratingDistribution: (f: F = {}) =>
    apiGet<RatingDistribution>("/reviews/rating-distribution", { ...f }),
  trend: (f: F = {}, granularity: "month" | "quarter" | "year" = "month") =>
    apiGet<ReviewTrend>("/reviews/trends", { ...f, granularity }),
  heatmap: (f: F = {}) => apiGet<ActivityHeatmap>("/reviews/activity-heatmap", { ...f }),
  topProducts: (f: F = {}, limit = 10) =>
    apiGet<RankedProduct[]>("/products/top-reviewed", { ...f, limit }),
  topProductsByYear: (year: number, f: F = {}, limit = 10) =>
    apiGet<YearRanking>("/products/top-by-year", { ...f, year, limit }),
  ratingPopularity: (f: F = {}, minReviews = 25, limit = 3000) =>
    apiGet<RatingPopularity>("/products/rating-popularity", {
      ...f,
      min_reviews: minReviews,
      limit,
    }),
  topBrands: (f: F = {}, limit = 10) => apiGet<TopBrands>("/brands/top", { ...f, limit }),
  catalogueCategories: (parent?: string, brand?: string) =>
    apiGet<CatalogueCategories>("/categories/catalogue", { parent, brand }),
  brands: (q: BrandListParams = {}) => apiGet<Page<BrandItem>>("/brands", { ...q }),
  brand: (name: string) => apiGet<BrandItem>("/brands/detail", { brand: name }),
  brandReviewStats: (
    f: F = {},
    opts: { minReviews?: number; sortBy?: BrandReviewSortField; order?: SortOrder; limit?: number } = {},
  ) =>
    apiGet<BrandReviewStats>("/brands/review-stats", {
      ...f,
      min_reviews: opts.minReviews,
      sort_by: opts.sortBy,
      order: opts.order,
      limit: opts.limit,
    }),
  products: (q: ProductListParams = {}) => apiGet<Page<ProductItem>>("/products", { ...q }),
  product: (productId: string) =>
    apiGet<ProductDetail>(`/products/${encodeURIComponent(productId)}`),
  compareProducts: (productIds: string[], granularity: "quarter" | "year" = "year") =>
    apiGet<ProductComparison>("/products/compare", { product_id: productIds, granularity }),
  reviewerProfiles: (f: F = {}) => apiGet<ReviewerProfiles>("/reviews/profiles", { ...f }),
  reviews: (q: ReviewListParams = {}) => apiGet<Page<ReviewItem>>("/reviews", { ...q }),
  reviewCategories: (f: F = {}) => apiGet<ReviewCategories>("/categories/reviews", { ...f }),
  priceDistribution: (binWidth = 10, maxPrice = 300) =>
    apiGet<PriceDistribution>("/prices/distribution", {
      bin_width: binWidth,
      max_price: maxPrice,
    }),
};
