/**
 * Review Analytics state (/reviews). The URL is the single source of truth, so every
 * view is shareable and rendered on the server.
 *
 * Filters (dates, subcategory, brand, product, rating, recommendation) scope every figure
 * on the page. The text search and the sort apply to the review table only, because the
 * API's text search is a table operation and not an aggregate filter.
 *
 * Values outside the review domain are dropped before they reach the API.
 */
import type { ReviewFilterParams, ReviewListParams } from "@/lib/api/types";
import type { RawSearchParams } from "@/lib/filters";
import { REVIEW_SORTS, type ReviewSortKey } from "@/lib/reviewListState";
import { normaliseSearch } from "@/lib/search";

export const REVIEW_TABLE_PAGE_SIZE = 20;
const PRODUCT_ID = /^P\d{1,12}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ReviewPageState {
  from?: string;
  to?: string;
  subcategory?: string;
  brand?: string;
  product?: string;
  rating?: number;
  recommended?: boolean;
  q?: string;
  sort: ReviewSortKey;
  page: number;
}

export interface ReviewDomain {
  brands: string[];
  subcategories: string[];
  /** First and last review dates (YYYY-MM-DD). */
  dateMin: string;
  dateMax: string;
}

export const DEFAULT_REVIEW_STATE: ReviewPageState = { sort: "recent", page: 1 };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** A real calendar date (rejects 2023-02-30) clamped to the dataset's date range. */
export function validDate(value: string | undefined, domain: ReviewDomain): string | undefined {
  if (!value || !ISO_DATE.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return undefined;
  if (domain.dateMin && value < domain.dateMin) return domain.dateMin;
  if (domain.dateMax && value > domain.dateMax) return domain.dateMax;
  return value;
}

export function parseReviewState(sp: RawSearchParams, domain: ReviewDomain): ReviewPageState {
  let from = validDate(first(sp.from), domain);
  let to = validDate(first(sp.to), domain);
  if (from && to && from > to) [from, to] = [to, from];

  const subcategory = first(sp.subcategory);
  const brand = first(sp.brand);
  const product = first(sp.product);
  const ratingRaw = first(sp.rating);
  const rec = first(sp.recommended);
  const sortRaw = first(sp.sort);
  const pageRaw = first(sp.page);

  return {
    from,
    to,
    subcategory: subcategory && domain.subcategories.includes(subcategory) ? subcategory : undefined,
    brand: brand && domain.brands.includes(brand) ? brand : undefined,
    product: product && PRODUCT_ID.test(product) ? product : undefined,
    rating: ratingRaw && /^[1-5]$/.test(ratingRaw) ? Number(ratingRaw) : undefined,
    recommended: rec === "yes" ? true : rec === "no" ? false : undefined,
    q: normaliseSearch(first(sp.q)),
    sort: sortRaw && Object.hasOwn(REVIEW_SORTS, sortRaw) ? (sortRaw as ReviewSortKey) : "recent",
    page: pageRaw && /^\d{1,5}$/.test(pageRaw) && Number(pageRaw) >= 1 ? Number(pageRaw) : 1,
  };
}

/** Filters shared by every aggregate on the page (no search, sort or paging). */
export function toReviewFilterParams(s: ReviewPageState): ReviewFilterParams {
  return {
    date_from: s.from,
    date_to: s.to,
    subcategory: s.subcategory ? [s.subcategory] : undefined,
    brand: s.brand ? [s.brand] : undefined,
    product_id: s.product ? [s.product] : undefined,
    rating: s.rating ? [s.rating] : undefined,
    recommended: s.recommended,
  };
}

export function toReviewTableParams(s: ReviewPageState, pageSize = REVIEW_TABLE_PAGE_SIZE): ReviewListParams {
  const { sort_by, order } = REVIEW_SORTS[s.sort];
  return { ...toReviewFilterParams(s), q: s.q, sort_by, order, page: s.page, page_size: pageSize };
}

/** URL params for a state; defaults are omitted so URLs stay short. */
export function toReviewPageSearchParams(s: ReviewPageState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.from) p.set("from", s.from);
  if (s.to) p.set("to", s.to);
  if (s.subcategory) p.set("subcategory", s.subcategory);
  if (s.brand) p.set("brand", s.brand);
  if (s.product) p.set("product", s.product);
  if (s.rating) p.set("rating", String(s.rating));
  if (s.recommended !== undefined) p.set("recommended", s.recommended ? "yes" : "no");
  if (s.q) p.set("q", s.q);
  if (s.sort !== "recent") p.set("sort", s.sort);
  if (s.page > 1) p.set("page", String(s.page));
  return p;
}

/** Link target for a drill-down that narrows the current view (always back to page 1). */
export function reviewHref(s: ReviewPageState, changes: Partial<ReviewPageState>): string {
  const qs = toReviewPageSearchParams(withReviewChanges(s, changes)).toString();
  return qs ? `/reviews?${qs}` : "/reviews";
}

/** Any change to what is matched or how it is ordered returns to page 1. */
export function withReviewChanges(s: ReviewPageState, changes: Partial<ReviewPageState>): ReviewPageState {
  const next = { ...s, ...changes };
  if (!("page" in changes)) next.page = 1;
  return next;
}

export type ReviewChipKey = "dates" | "subcategory" | "brand" | "product" | "rating" | "recommended" | "q";

export interface ReviewChip {
  key: ReviewChipKey;
  label: string;
}

/** Active filter chips; the product chip uses the product's name when it is known. */
export function reviewChips(s: ReviewPageState, productName?: string): ReviewChip[] {
  const out: ReviewChip[] = [];
  if (s.from || s.to) {
    out.push({
      key: "dates",
      label: s.from && s.to ? `${s.from} – ${s.to}` : s.from ? `From ${s.from}` : `Until ${s.to}`,
    });
  }
  if (s.subcategory) out.push({ key: "subcategory", label: s.subcategory });
  if (s.brand) out.push({ key: "brand", label: s.brand });
  if (s.product) out.push({ key: "product", label: productName ?? s.product });
  if (s.rating) out.push({ key: "rating", label: `${s.rating} star${s.rating === 1 ? "" : "s"}` });
  if (s.recommended !== undefined) {
    out.push({ key: "recommended", label: s.recommended ? "Recommends" : "Does not recommend" });
  }
  if (s.q) out.push({ key: "q", label: `“${s.q}”` });
  return out;
}

export function clearReviewChip(s: ReviewPageState, key: ReviewChipKey): ReviewPageState {
  if (key === "dates") return withReviewChanges(s, { from: undefined, to: undefined });
  return withReviewChanges(s, { [key]: undefined });
}

/** True when any aggregate filter is set (the search alone does not change the charts). */
export function hasReviewPageFilters(s: ReviewPageState): boolean {
  return reviewChips(s).some((c) => c.key !== "q");
}

export function clearAllReviewFilters(s: ReviewPageState): ReviewPageState {
  return { sort: s.sort, page: 1 };
}
