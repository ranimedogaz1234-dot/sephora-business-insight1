/**
 * Product explorer state (/products). As on the overview, the URL is the single source
 * of truth: every filter, sort and page is shareable and server-rendered.
 *
 * All figures come from the catalogue (product_info.csv, all nine categories). Values
 * that are not in the catalogue domain are dropped rather than sent to the API.
 */
import type { ProductListParams, ProductSortField, SortOrder } from "@/lib/api/types";
import type { RawSearchParams } from "@/lib/filters";
import { normaliseSearch } from "@/lib/search";

export { MAX_SEARCH_LENGTH, MIN_SEARCH_LENGTH, normaliseSearch } from "@/lib/search";

export const PRODUCT_PAGE_SIZE = 25;
export const MIN_RATING_OPTIONS = [4.5, 4, 3.5, 3] as const;

export const PRODUCT_SORT_FIELDS: readonly ProductSortField[] = [
  "product_name",
  "brand_name",
  "price_usd",
  "catalogue_rating",
  "loves_count",
  "sephora_review_count",
  "review_record_count",
  "review_average_rating",
];

/** Sort presets offered in the "Sort by" menu (column headers allow any whitelisted field). */
export const SORT_PRESETS: { value: string; label: string; sort: ProductSortField; order: SortOrder }[] = [
  { value: "loves_count:desc", label: "Most popular (loves)", sort: "loves_count", order: "desc" },
  { value: "sephora_review_count:desc", label: "Most reviewed", sort: "sephora_review_count", order: "desc" },
  { value: "catalogue_rating:desc", label: "Highest rated", sort: "catalogue_rating", order: "desc" },
  { value: "price_usd:asc", label: "Price: low to high", sort: "price_usd", order: "asc" },
  { value: "price_usd:desc", label: "Price: high to low", sort: "price_usd", order: "desc" },
  { value: "review_record_count:desc", label: "Most review records", sort: "review_record_count", order: "desc" },
  { value: "product_name:asc", label: "Name A–Z", sort: "product_name", order: "asc" },
];

/** Natural first direction when a column header is clicked: text A→Z, numbers high→low. */
export const defaultOrderFor = (field: ProductSortField): SortOrder =>
  field === "product_name" || field === "brand_name" ? "asc" : "desc";

export interface ProductFilters {
  q?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  minRating?: number;
  sort: ProductSortField;
  order: SortOrder;
  page: number;
}

export interface ProductDomain {
  categories: string[];
  /** Secondary categories per primary category. */
  subcategories: Record<string, string[]>;
  brands: string[];
  priceMax: number;
}

export const DEFAULT_SORT: ProductSortField = "loves_count";
export const DEFAULT_ORDER: SortOrder = "desc";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function price(value: string | undefined, max: number): number | undefined {
  if (!value || !/^\d{1,6}(\.\d{1,2})?$/.test(value)) return undefined;
  const n = Number(value);
  return n >= 0 && n <= Math.max(max, 0) ? n : undefined;
}

export function parseProductFilters(sp: RawSearchParams, domain: ProductDomain): ProductFilters {
  const category = first(sp.category);
  const validCategory = category && domain.categories.includes(category) ? category : undefined;
  const subcategory = first(sp.subcategory);
  const validSub =
    validCategory && subcategory && (domain.subcategories[validCategory] ?? []).includes(subcategory)
      ? subcategory
      : undefined;
  const brand = first(sp.brand);

  let priceMin = price(first(sp.price_min), domain.priceMax);
  let priceMax = price(first(sp.price_max), domain.priceMax);
  if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
    [priceMin, priceMax] = [priceMax, priceMin];
  }

  const ratingRaw = Number(first(sp.min_rating));
  const minRating = (MIN_RATING_OPTIONS as readonly number[]).includes(ratingRaw) ? ratingRaw : undefined;

  const sortRaw = first(sp.sort) as ProductSortField | undefined;
  const sort = sortRaw && PRODUCT_SORT_FIELDS.includes(sortRaw) ? sortRaw : DEFAULT_SORT;
  const orderRaw = first(sp.order);
  const order: SortOrder =
    orderRaw === "asc" || orderRaw === "desc" ? orderRaw : sort === DEFAULT_SORT ? DEFAULT_ORDER : defaultOrderFor(sort);

  const pageRaw = first(sp.page);
  const page = pageRaw && /^\d{1,5}$/.test(pageRaw) && Number(pageRaw) >= 1 ? Number(pageRaw) : 1;

  return {
    q: normaliseSearch(first(sp.q)),
    category: validCategory,
    subcategory: validSub,
    brand: brand && domain.brands.includes(brand) ? brand : undefined,
    priceMin,
    priceMax,
    minRating,
    sort,
    order,
    page,
  };
}

export function toProductApiParams(f: ProductFilters, pageSize = PRODUCT_PAGE_SIZE): ProductListParams {
  return {
    q: f.q,
    primary_category: f.category ? [f.category] : undefined,
    secondary_category: f.subcategory ? [f.subcategory] : undefined,
    brand: f.brand ? [f.brand] : undefined,
    price_min: f.priceMin,
    price_max: f.priceMax,
    min_catalogue_rating: f.minRating,
    sort_by: f.sort,
    order: f.order,
    page: f.page,
    page_size: pageSize,
  };
}

/** URL params for a state; defaults are omitted so URLs stay short. */
export function toProductSearchParams(f: ProductFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.category) p.set("category", f.category);
  if (f.category && f.subcategory) p.set("subcategory", f.subcategory);
  if (f.brand) p.set("brand", f.brand);
  if (f.priceMin !== undefined) p.set("price_min", String(f.priceMin));
  if (f.priceMax !== undefined) p.set("price_max", String(f.priceMax));
  if (f.minRating !== undefined) p.set("min_rating", String(f.minRating));
  if (f.sort !== DEFAULT_SORT || f.order !== DEFAULT_ORDER) {
    p.set("sort", f.sort);
    p.set("order", f.order);
  }
  if (f.page > 1) p.set("page", String(f.page));
  return p;
}

/** Any change to what is matched or how it is ordered returns to page 1. */
export function withChanges(f: ProductFilters, changes: Partial<ProductFilters>): ProductFilters {
  const next = { ...f, ...changes };
  if (!("page" in changes)) next.page = 1;
  if ("category" in changes && changes.category !== f.category) next.subcategory = undefined;
  return next;
}

/** Clicking a header: same column flips the direction, a new column starts at its natural one. */
export function toggleSort(f: ProductFilters, field: ProductSortField): ProductFilters {
  const order = f.sort === field ? (f.order === "asc" ? "desc" : "asc") : defaultOrderFor(field);
  return withChanges(f, { sort: field, order });
}

export type ProductChipKey = "q" | "category" | "subcategory" | "brand" | "price" | "minRating";

export function productChips(f: ProductFilters): { key: ProductChipKey; label: string }[] {
  const out: { key: ProductChipKey; label: string }[] = [];
  if (f.q) out.push({ key: "q", label: `“${f.q}”` });
  if (f.category) out.push({ key: "category", label: f.category });
  if (f.subcategory) out.push({ key: "subcategory", label: f.subcategory });
  if (f.brand) out.push({ key: "brand", label: f.brand });
  if (f.priceMin !== undefined || f.priceMax !== undefined) {
    const lo = f.priceMin !== undefined ? `$${f.priceMin}` : "$0";
    out.push({ key: "price", label: f.priceMax !== undefined ? `${lo} – $${f.priceMax}` : `${lo} and up` });
  }
  if (f.minRating !== undefined) out.push({ key: "minRating", label: `Rated ${f.minRating}+` });
  return out;
}

export function clearProductChip(f: ProductFilters, key: ProductChipKey): ProductFilters {
  switch (key) {
    case "price":
      return withChanges(f, { priceMin: undefined, priceMax: undefined });
    case "category":
      return withChanges(f, { category: undefined, subcategory: undefined });
    default:
      return withChanges(f, { [key]: undefined });
  }
}

export function hasProductFilters(f: ProductFilters): boolean {
  return productChips(f).length > 0;
}

export function clearAllProductFilters(f: ProductFilters): ProductFilters {
  return { sort: f.sort, order: f.order, page: 1 };
}
