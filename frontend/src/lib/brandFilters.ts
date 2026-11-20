/**
 * Brands & Categories state (/brands). As on the other pages, the URL is the single source
 * of truth, so every view is shareable and rendered on the server.
 *
 * - subcategory and minReviews scope the review-based figures (Skincare review records).
 * - category drills the catalogue mix from primary categories into one category's
 *   subcategories (catalogue, all nine categories).
 * - brand opens the brand focus panel.
 * - q, sort, order and page drive the brand directory table.
 */
import type { BrandListParams, BrandSortField, SortOrder } from "@/lib/api/types";
import type { RawSearchParams } from "@/lib/filters";
import { normaliseSearch } from "@/lib/search";

export const BRAND_PAGE_SIZE = 15;
/** Minimum review records before a brand appears in rating rankings and the landscape chart. */
export const MIN_REVIEW_OPTIONS = [25, 100, 500, 1000] as const;
export const DEFAULT_MIN_REVIEWS = 100;

export const BRAND_SORT_FIELDS: readonly BrandSortField[] = [
  "brand_name",
  "product_count",
  "average_price",
  "loves_count",
  "sephora_review_count",
  "review_record_count",
  "review_average_rating",
];
export const DEFAULT_BRAND_SORT: BrandSortField = "review_record_count";
export const DEFAULT_BRAND_ORDER: SortOrder = "desc";

export const defaultBrandOrderFor = (field: BrandSortField): SortOrder => (field === "brand_name" ? "asc" : "desc");

export interface BrandPageState {
  subcategory?: string;
  minReviews: number;
  category?: string;
  brand?: string;
  q?: string;
  sort: BrandSortField;
  order: SortOrder;
  page: number;
}

export interface BrandDomain {
  /** Catalogue brands (all 304 in the real data). */
  brands: string[];
  /** Catalogue primary categories. */
  categories: string[];
  /** Skincare subcategories that have review records. */
  subcategories: string[];
}

export const DEFAULT_BRAND_STATE: BrandPageState = {
  minReviews: DEFAULT_MIN_REVIEWS,
  sort: DEFAULT_BRAND_SORT,
  order: DEFAULT_BRAND_ORDER,
  page: 1,
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const oneOf = (v: string | undefined, allowed: readonly string[]) => (v && allowed.includes(v) ? v : undefined);

export function parseBrandState(sp: RawSearchParams, domain: BrandDomain): BrandPageState {
  const minRaw = Number(first(sp.min_reviews));
  const minReviews = (MIN_REVIEW_OPTIONS as readonly number[]).includes(minRaw) ? minRaw : DEFAULT_MIN_REVIEWS;
  const sortRaw = first(sp.sort) as BrandSortField | undefined;
  const sort = sortRaw && BRAND_SORT_FIELDS.includes(sortRaw) ? sortRaw : DEFAULT_BRAND_SORT;
  const orderRaw = first(sp.order);
  const order: SortOrder =
    orderRaw === "asc" || orderRaw === "desc"
      ? orderRaw
      : sort === DEFAULT_BRAND_SORT
        ? DEFAULT_BRAND_ORDER
        : defaultBrandOrderFor(sort);
  const pageRaw = first(sp.page);

  return {
    subcategory: oneOf(first(sp.subcategory), domain.subcategories),
    minReviews,
    category: oneOf(first(sp.category), domain.categories),
    brand: oneOf(first(sp.brand), domain.brands),
    q: normaliseSearch(first(sp.q)),
    sort,
    order,
    page: pageRaw && /^\d{1,5}$/.test(pageRaw) && Number(pageRaw) >= 1 ? Number(pageRaw) : 1,
  };
}

/** URL params for a state; defaults are omitted so URLs stay short. */
export function toBrandSearchParams(s: BrandPageState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.subcategory) p.set("subcategory", s.subcategory);
  if (s.minReviews !== DEFAULT_MIN_REVIEWS) p.set("min_reviews", String(s.minReviews));
  if (s.category) p.set("category", s.category);
  if (s.brand) p.set("brand", s.brand);
  if (s.q) p.set("q", s.q);
  if (s.sort !== DEFAULT_BRAND_SORT || s.order !== DEFAULT_BRAND_ORDER) {
    p.set("sort", s.sort);
    p.set("order", s.order);
  }
  if (s.page > 1) p.set("page", String(s.page));
  return p;
}

/** Changing what the directory matches or how it is ordered returns it to page 1. */
export function withBrandChanges(s: BrandPageState, changes: Partial<BrandPageState>): BrandPageState {
  const next = { ...s, ...changes };
  const directoryChanged = "q" in changes || "sort" in changes || "order" in changes;
  if (directoryChanged && !("page" in changes)) next.page = 1;
  return next;
}

/** Link target for a drill-down (brand focus, category drill, subcategory filter). */
export function brandHref(s: BrandPageState, changes: Partial<BrandPageState>, hash?: string): string {
  const qs = toBrandSearchParams(withBrandChanges(s, changes)).toString();
  return `/brands${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
}

/** Clicking a directory header: same column flips direction, a new column starts at its natural one. */
export function toggleBrandSort(s: BrandPageState, field: BrandSortField): BrandPageState {
  const order = s.sort === field ? (s.order === "asc" ? "desc" : "asc") : defaultBrandOrderFor(field);
  return withBrandChanges(s, { sort: field, order });
}

export function toBrandListParams(s: BrandPageState): BrandListParams {
  return { q: s.q, sort_by: s.sort, order: s.order, page: s.page, page_size: BRAND_PAGE_SIZE };
}

/** True when a review-scope filter is set (it changes the review-based figures). */
export function hasBrandReviewFilters(s: BrandPageState): boolean {
  return !!s.subcategory;
}
