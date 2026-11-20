"use client";

import { useState } from "react";
import Link from "next/link";
import { Filter, ThumbsUp } from "lucide-react";
import type { Page, ReviewItem } from "@/lib/api/types";
import { formatDate, formatInteger } from "@/lib/format";
import { REVIEW_SORTS, type ReviewSortKey } from "@/lib/reviewListState";
import {
  REVIEW_TABLE_PAGE_SIZE,
  reviewHref,
  toReviewPageSearchParams,
  withReviewChanges,
  type ReviewPageState,
} from "@/lib/reviewFilters";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";
import { Stars } from "@/components/products/ProductReviewList";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/States";
import { ReviewSearch } from "./ReviewFilterBar";

const EXCERPT = 220;

function Excerpt({ review }: { review: ReviewItem }) {
  const [open, setOpen] = useState(false);
  const text = review.review_text ?? "";
  const long = text.length > EXCERPT;
  return (
    <div className="min-w-0">
      {review.review_title && <p className="font-medium text-charcoal">{review.review_title}</p>}
      {text ? (
        <p className="mt-0.5 whitespace-pre-line break-words text-ink-2">
          {long && !open ? `${text.slice(0, EXCERPT).trimEnd()}…` : text}
        </p>
      ) : (
        <p className="mt-0.5 italic text-ink-3">No review text.</p>
      )}
      {long && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="mt-1 text-xs font-medium text-burgundy hover:underline"
        >
          {open ? "Show less" : "Read full review"}
        </button>
      )}
    </div>
  );
}

function Recommends({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-ink-3">—</span>;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-px text-[11px] font-medium ${
        value ? "bg-soft-pink text-burgundy" : "bg-light-gray text-ink-2"
      }`}
    >
      {value ? "Recommends" : "Does not"}
    </span>
  );
}

function Helpful({ review }: { review: ReviewItem }) {
  if (review.total_feedback_count === 0) return <span className="text-ink-3">—</span>;
  return (
    <span
      className="inline-flex items-center gap-1 tabular-nums text-ink-2"
      title={`${review.total_pos_feedback_count} of ${review.total_feedback_count} found this helpful`}
    >
      <ThumbsUp aria-hidden className="h-3 w-3" strokeWidth={2} />
      {formatInteger(review.total_pos_feedback_count)}
      <span className="text-ink-3">/ {formatInteger(review.total_feedback_count)}</span>
    </span>
  );
}

function ProductCell({ review, state }: { review: ReviewItem; state: ReviewPageState }) {
  return (
    <div className="min-w-0">
      <Link
        href={`/products/${encodeURIComponent(review.product_id)}`}
        className="font-medium text-charcoal hover:text-burgundy hover:underline"
      >
        {review.product_name}
      </Link>
      <p className="text-xs text-ink-3">
        {review.brand_name}
        {review.subcategory && ` · ${review.subcategory}`}
      </p>
      {state.product !== review.product_id && (
        <Link
          href={reviewHref(state, { product: review.product_id })}
          scroll={false}
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-burgundy hover:underline"
          aria-label={`Show only reviews of ${review.product_name}`}
        >
          <Filter aria-hidden className="h-3 w-3" strokeWidth={2} />
          Only this product
        </Link>
      )}
    </div>
  );
}

interface ReviewTableProps {
  reviews: Page<ReviewItem>;
  state: ReviewPageState;
}

export function ReviewTable({ reviews, state }: ReviewTableProps) {
  const { setQuery } = useNavigationTransition();
  const query = toReviewPageSearchParams(state).toString();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 items-end gap-3 sm:flex sm:flex-wrap" role="group" aria-label="Review table options">
        <ReviewSearch state={state} />
        <Select
          label="Sort reviews"
          value={state.sort}
          onChange={(v) => setQuery(toReviewPageSearchParams(withReviewChanges(state, { sort: v as ReviewSortKey })))}
          width="sm:w-44"
        >
          {Object.entries(REVIEW_SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
      </div>

      {reviews.total === 0 ? (
        <EmptyState
          message={
            state.q
              ? `No reviews mention “${state.q}” with the current filters.`
              : "No reviews match the current filters."
          }
        />
      ) : reviews.items.length === 0 ? (
        <EmptyState message="This page is past the end of the results." />
      ) : (
        <>
          {/* Tablet and desktop: analytical table */}
          <div className="relative hidden overflow-x-auto rounded-lg border border-line md:block">
            <table className="w-full min-w-[860px] text-left text-sm">
              <caption className="sr-only">Review records, {REVIEW_SORTS[state.sort].label.toLowerCase()}</caption>
              <thead className="bg-light-gray text-[11px] font-medium uppercase tracking-wide text-ink-3">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Rating</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Review</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Product</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Recommends</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Helpful</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {reviews.items.map((r) => (
                  <tr key={r.review_id} className="align-top transition-colors hover:bg-soft-pink/40">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-2">
                      <time dateTime={r.submission_date}>{formatDate(r.submission_date)}</time>
                    </td>
                    <td className="px-4 py-3">
                      <Stars rating={r.rating} />
                    </td>
                    <td className="w-[42%] px-4 py-3">
                      <Excerpt review={r} />
                    </td>
                    <td className="w-[24%] px-4 py-3">
                      <ProductCell review={r} state={state} />
                    </td>
                    <td className="px-4 py-3">
                      <Recommends value={r.is_recommended} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Helpful review={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: one card per review */}
          <ul className="space-y-3 md:hidden" aria-label="Review records">
            {reviews.items.map((r) => (
              <li key={r.review_id} className="rounded-lg border border-line p-4 text-sm">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars rating={r.rating} />
                  <time dateTime={r.submission_date} className="text-xs text-ink-3">
                    {formatDate(r.submission_date)}
                  </time>
                  <Recommends value={r.is_recommended} />
                </div>
                <div className="mt-2">
                  <Excerpt review={r} />
                </div>
                <div className="mt-3 flex items-end justify-between gap-3 border-t border-line pt-3">
                  <ProductCell review={r} state={state} />
                  <span className="shrink-0 text-xs">
                    <Helpful review={r} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Pagination
        page={state.page}
        totalPages={reviews.total_pages}
        total={reviews.total}
        pageSize={REVIEW_TABLE_PAGE_SIZE}
        query={query}
        noun={["review", "reviews"]}
        label="Review pages"
      />
    </div>
  );
}
