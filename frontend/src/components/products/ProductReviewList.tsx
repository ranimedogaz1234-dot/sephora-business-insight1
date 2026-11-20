"use client";

import { useState } from "react";
import { Star, ThumbsUp } from "lucide-react";
import type { Page, ReviewItem } from "@/lib/api/types";
import { formatDate, formatInteger } from "@/lib/format";
import {
  REVIEW_PAGE_SIZE,
  REVIEW_SORTS,
  toReviewSearchParams,
  type ReviewListState,
  type ReviewSortKey,
} from "@/lib/reviewListState";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/States";

const COLLAPSE_AT = 360;

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={`h-3.5 w-3.5 ${i <= rating ? "fill-burgundy text-burgundy" : "fill-none text-line-strong"}`}
          strokeWidth={1.75}
        />
      ))}
    </span>
  );
}

function ReviewText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > COLLAPSE_AT;
  return (
    <div className="mt-1.5 text-sm leading-relaxed text-ink-2">
      <p className="whitespace-pre-line break-words">{long && !open ? `${text.slice(0, COLLAPSE_AT).trimEnd()}…` : text}</p>
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

function ReviewCard({ review }: { review: ReviewItem }) {
  const profile = [review.skin_type && `${review.skin_type} skin`, review.skin_tone && `${review.skin_tone} tone`]
    .filter(Boolean)
    .join(" · ");
  return (
    <article className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars rating={review.rating} />
        <time dateTime={review.submission_date} className="text-xs text-ink-3">
          {formatDate(review.submission_date)}
        </time>
        {review.is_recommended !== null && (
          <span
            className={`rounded-full px-2 py-px text-[11px] font-medium ${
              review.is_recommended ? "bg-soft-pink text-burgundy" : "bg-light-gray text-ink-2"
            }`}
          >
            {review.is_recommended ? "Recommends" : "Does not recommend"}
          </span>
        )}
      </div>
      {review.review_title && <h4 className="mt-2 text-sm font-semibold text-charcoal">{review.review_title}</h4>}
      {review.review_text ? (
        <ReviewText text={review.review_text} />
      ) : (
        <p className="mt-1.5 text-sm italic text-ink-3">No review text.</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
        {profile && <span>{profile}</span>}
        {review.total_feedback_count > 0 && (
          <span className="inline-flex items-center gap-1">
            <ThumbsUp aria-hidden className="h-3 w-3" strokeWidth={2} />
            {formatInteger(review.total_pos_feedback_count)} of {formatInteger(review.total_feedback_count)} found this
            helpful
          </span>
        )}
      </div>
    </article>
  );
}

interface ProductReviewListProps {
  reviews: Page<ReviewItem>;
  state: ReviewListState;
}

export function ProductReviewList({ reviews, state }: ProductReviewListProps) {
  const { setQuery } = useNavigationTransition();
  const apply = (next: ReviewListState) => setQuery(toReviewSearchParams(next));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap" role="group" aria-label="Review list options">
        <Select
          label="Sort reviews"
          value={state.sort}
          onChange={(v) => apply({ ...state, sort: v as ReviewSortKey, page: 1 })}
          width="sm:w-44"
        >
          {Object.entries(REVIEW_SORTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>
        <Select
          label="Star rating"
          value={state.rating ? String(state.rating) : ""}
          onChange={(v) => apply({ ...state, rating: v ? Number(v) : undefined, page: 1 })}
          width="sm:w-36"
        >
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} star{r === 1 ? "" : "s"}
            </option>
          ))}
        </Select>
      </div>

      {reviews.total === 0 ? (
        <EmptyState message={state.rating ? `No ${state.rating}-star reviews for this product.` : "No review records."} />
      ) : (
        <div>
          {reviews.items.map((r) => (
            <ReviewCard key={r.review_id} review={r} />
          ))}
        </div>
      )}

      <Pagination
        page={state.page}
        totalPages={reviews.total_pages}
        total={reviews.total}
        pageSize={REVIEW_PAGE_SIZE}
        query={toReviewSearchParams(state).toString()}
        pageParam="rpage"
        noun={["review", "reviews"]}
        label="Review pages"
      />
    </div>
  );
}
