/**
 * Data Explorer state (/explorer), kept in the URL. One dataset is active at a time and drives
 * the missing-value chart, the column dictionary and the record browser.
 */
import type {
  DatasetTable,
  ProductListParams,
  ProductSortField,
  ReviewListParams,
  ReviewSortField,
  SortOrder,
} from "@/lib/api/types";
import type { RawSearchParams } from "@/lib/filters";
import { normaliseSearch } from "@/lib/search";

export const EXPLORER_PAGE_SIZE = 25;

type Sort<F> = { label: string; sort_by: F; order: SortOrder };

export const PRODUCT_SORTS = {
  loves: { label: "Most loved", sort_by: "loves_count", order: "desc" },
  records: { label: "Most review records", sort_by: "review_record_count", order: "desc" },
  rating: { label: "Highest catalogue rating", sort_by: "catalogue_rating", order: "desc" },
  price_asc: { label: "Price: low to high", sort_by: "price_usd", order: "asc" },
  price_desc: { label: "Price: high to low", sort_by: "price_usd", order: "desc" },
  name: { label: "Name A–Z", sort_by: "product_name", order: "asc" },
} as const satisfies Record<string, Sort<ProductSortField>>;

export const RECORD_SORTS = {
  recent: { label: "Most recent", sort_by: "submission_time", order: "desc" },
  oldest: { label: "Oldest first", sort_by: "submission_time", order: "asc" },
  helpful: { label: "Most helpful votes", sort_by: "total_pos_feedback_count", order: "desc" },
  highest: { label: "Highest rating", sort_by: "rating", order: "desc" },
  lowest: { label: "Lowest rating", sort_by: "rating", order: "asc" },
} as const satisfies Record<string, Sort<ReviewSortField>>;

export interface ExplorerState {
  ds: DatasetTable;
  q?: string;
  /** Products: primary category. */
  category?: string;
  /** Reviews: Skincare subcategory and star rating. */
  subcategory?: string;
  rating?: number;
  sort: string;
  page: number;
}

export interface ExplorerDomain {
  categories: string[];
  subcategories: string[];
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const defaultSort = (ds: DatasetTable) => (ds === "products" ? "loves" : "recent");

export function parseExplorerState(sp: RawSearchParams, domain: ExplorerDomain): ExplorerState {
  const ds: DatasetTable = first(sp.ds) === "reviews" ? "reviews" : "products";
  const sorts = ds === "products" ? PRODUCT_SORTS : RECORD_SORTS;
  const sortRaw = first(sp.sort);
  const pageRaw = first(sp.page);
  const category = first(sp.category);
  const subcategory = first(sp.subcategory);
  const rating = first(sp.rating);
  return {
    ds,
    q: normaliseSearch(first(sp.q)),
    category: ds === "products" && category && domain.categories.includes(category) ? category : undefined,
    subcategory:
      ds === "reviews" && subcategory && domain.subcategories.includes(subcategory) ? subcategory : undefined,
    rating: ds === "reviews" && rating && /^[1-5]$/.test(rating) ? Number(rating) : undefined,
    sort: sortRaw && Object.hasOwn(sorts, sortRaw) ? sortRaw : defaultSort(ds),
    page: pageRaw && /^\d{1,5}$/.test(pageRaw) && Number(pageRaw) >= 1 ? Number(pageRaw) : 1,
  };
}

export function toExplorerSearchParams(s: ExplorerState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.ds !== "products") p.set("ds", s.ds);
  if (s.q) p.set("q", s.q);
  if (s.category) p.set("category", s.category);
  if (s.subcategory) p.set("subcategory", s.subcategory);
  if (s.rating) p.set("rating", String(s.rating));
  if (s.sort !== defaultSort(s.ds)) p.set("sort", s.sort);
  if (s.page > 1) p.set("page", String(s.page));
  return p;
}

/** Switching dataset starts fresh; any other change returns to page 1. */
export function withExplorerChanges(s: ExplorerState, changes: Partial<ExplorerState>): ExplorerState {
  if (changes.ds && changes.ds !== s.ds) return { ds: changes.ds, sort: defaultSort(changes.ds), page: 1 };
  const next = { ...s, ...changes };
  if (!("page" in changes)) next.page = 1;
  return next;
}

export function toProductRecordParams(s: ExplorerState): ProductListParams {
  const { sort_by, order } = PRODUCT_SORTS[s.sort as keyof typeof PRODUCT_SORTS] ?? PRODUCT_SORTS.loves;
  return {
    q: s.q,
    primary_category: s.category ? [s.category] : undefined,
    sort_by,
    order,
    page: s.page,
    page_size: EXPLORER_PAGE_SIZE,
  };
}

export function toReviewRecordParams(s: ExplorerState): ReviewListParams {
  const { sort_by, order } = RECORD_SORTS[s.sort as keyof typeof RECORD_SORTS] ?? RECORD_SORTS.recent;
  return {
    q: s.q,
    subcategory: s.subcategory ? [s.subcategory] : undefined,
    rating: s.rating ? [s.rating] : undefined,
    sort_by,
    order,
    page: s.page,
    page_size: EXPLORER_PAGE_SIZE,
  };
}

export const hasExplorerFilters = (s: ExplorerState) => !!(s.q || s.category || s.subcategory || s.rating);
