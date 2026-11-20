/**
 * Customer-review list state on a product page, kept in the URL (rsort, rrating, rpage)
 * so it is shareable and rendered on the server.
 */
import type { ReviewListParams, ReviewSortField, SortOrder } from "@/lib/api/types";
import type { RawSearchParams } from "@/lib/filters";

export const REVIEW_PAGE_SIZE = 10;

export const REVIEW_SORTS = {
  recent: { label: "Most recent", sort_by: "submission_time", order: "desc" },
  oldest: { label: "Oldest first", sort_by: "submission_time", order: "asc" },
  // Positive-feedback count, not the helpfulness ratio: a 1/1 vote would otherwise rank first.
  helpful: { label: "Most helpful", sort_by: "total_pos_feedback_count", order: "desc" },
  highest: { label: "Highest rating", sort_by: "rating", order: "desc" },
  lowest: { label: "Lowest rating", sort_by: "rating", order: "asc" },
} as const satisfies Record<string, { label: string; sort_by: ReviewSortField; order: SortOrder }>;

export type ReviewSortKey = keyof typeof REVIEW_SORTS;

export interface ReviewListState {
  sort: ReviewSortKey;
  rating?: number;
  page: number;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseReviewListState(sp: RawSearchParams): ReviewListState {
  const sortRaw = first(sp.rsort);
  const sort: ReviewSortKey = sortRaw && sortRaw in REVIEW_SORTS ? (sortRaw as ReviewSortKey) : "recent";
  const ratingRaw = first(sp.rrating);
  const rating = ratingRaw && /^[1-5]$/.test(ratingRaw) ? Number(ratingRaw) : undefined;
  const pageRaw = first(sp.rpage);
  const page = pageRaw && /^\d{1,5}$/.test(pageRaw) && Number(pageRaw) >= 1 ? Number(pageRaw) : 1;
  return { sort, rating, page };
}

export function toReviewApiParams(productId: string, s: ReviewListState): ReviewListParams {
  const { sort_by, order } = REVIEW_SORTS[s.sort];
  return {
    product_id: [productId],
    rating: s.rating ? [s.rating] : undefined,
    sort_by,
    order,
    page: s.page,
    page_size: REVIEW_PAGE_SIZE,
  };
}

export function toReviewSearchParams(s: ReviewListState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.sort !== "recent") p.set("rsort", s.sort);
  if (s.rating) p.set("rrating", String(s.rating));
  if (s.page > 1) p.set("rpage", String(s.page));
  return p;
}
