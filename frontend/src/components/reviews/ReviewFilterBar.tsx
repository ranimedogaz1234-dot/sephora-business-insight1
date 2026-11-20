"use client";

import { useState } from "react";
import { RotateCcw, X } from "lucide-react";
import type { NamedCount } from "@/lib/api/types";
import { formatInteger } from "@/lib/format";
import {
  clearAllReviewFilters,
  clearReviewChip,
  reviewChips,
  toReviewPageSearchParams,
  validDate,
  withReviewChanges,
  type ReviewDomain,
  type ReviewPageState,
} from "@/lib/reviewFilters";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";
import { SearchField } from "@/components/ui/SearchField";
import { Select } from "@/components/ui/Select";

interface ReviewFilterBarProps {
  state: ReviewPageState;
  domain: ReviewDomain;
  subcategories: NamedCount[];
  brands: NamedCount[];
  /** Name of the product in the product filter, when one is set and known. */
  productName?: string;
}

/** From/to date inputs, applied together on blur or Enter (not on every keystroke). */
function DateRange({
  from,
  to,
  domain,
  onApply,
}: {
  from?: string;
  to?: string;
  domain: ReviewDomain;
  onApply: (from: string | undefined, to: string | undefined) => void;
}) {
  const [lo, setLo] = useState(from ?? "");
  const [hi, setHi] = useState(to ?? "");
  const apply = () => {
    let a = validDate(lo || undefined, domain);
    let b = validDate(hi || undefined, domain);
    if (a && b && a > b) [a, b] = [b, a];
    if (a !== from || b !== to) onApply(a, b);
  };
  const input =
    "h-9 w-full min-w-0 rounded-md border border-line bg-white px-2 text-sm tabular-nums text-charcoal transition-colors hover:border-line-strong focus:border-burgundy focus:outline-none";
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 text-[11px] font-medium text-ink-3">Review date</legend>
      <div className="flex items-center gap-1.5 sm:w-[19rem]">
        <input
          type="date"
          aria-label="From date"
          min={domain.dateMin}
          max={domain.dateMax}
          value={lo}
          onChange={(e) => setLo(e.target.value)}
          onBlur={apply}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          className={input}
        />
        <span aria-hidden className="text-ink-3">
          –
        </span>
        <input
          type="date"
          aria-label="To date"
          min={domain.dateMin}
          max={domain.dateMax}
          value={hi}
          onChange={(e) => setHi(e.target.value)}
          onBlur={apply}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          className={input}
        />
      </div>
    </fieldset>
  );
}

export function ReviewFilterBar({ state, domain, subcategories, brands, productName }: ReviewFilterBarProps) {
  const { setQuery, isPending } = useNavigationTransition();
  const apply = (next: ReviewPageState) => setQuery(toReviewPageSearchParams(next));
  const change = (changes: Partial<ReviewPageState>) => apply(withReviewChanges(state, changes));
  const chips = reviewChips(state, productName);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap" role="group" aria-label="Review filters">
        <div className="col-span-2 sm:col-span-1">
          <DateRange
            key={`${state.from ?? ""}-${state.to ?? ""}`}
            from={state.from}
            to={state.to}
            domain={domain}
            onApply={(from, to) => change({ from, to })}
          />
        </div>

        <Select
          label="Skincare subcategory"
          value={state.subcategory ?? ""}
          onChange={(v) => change({ subcategory: v || undefined })}
          width="sm:w-48"
        >
          <option value="">All subcategories</option>
          {subcategories.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} ({formatInteger(s.count)})
            </option>
          ))}
        </Select>

        <Select
          label="Brand"
          value={state.brand ?? ""}
          onChange={(v) => change({ brand: v || undefined })}
          width="sm:w-48"
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name} ({formatInteger(b.count)})
            </option>
          ))}
        </Select>

        <Select
          label="Star rating"
          value={state.rating ? String(state.rating) : ""}
          onChange={(v) => change({ rating: v ? Number(v) : undefined })}
          width="sm:w-32"
        >
          <option value="">All ratings</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} star{r === 1 ? "" : "s"}
            </option>
          ))}
        </Select>

        <Select
          label="Recommendation"
          value={state.recommended === undefined ? "" : state.recommended ? "yes" : "no"}
          onChange={(v) => change({ recommended: v === "yes" ? true : v === "no" ? false : undefined })}
          width="sm:w-44"
        >
          <option value="">Any answer</option>
          <option value="yes">Recommends</option>
          <option value="no">Does not recommend</option>
        </Select>

        {chips.length > 0 && (
          <button
            type="button"
            onClick={() => apply(clearAllReviewFilters(state))}
            className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm text-ink-2 transition-colors hover:bg-light-gray hover:text-charcoal"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Reset
          </button>
        )}

        <span aria-live="polite" className="h-9 self-end text-xs leading-9 text-ink-3">
          {isPending ? "Updating…" : ""}
        </span>
      </div>

      {chips.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => apply(clearReviewChip(state, chip.key))}
                aria-label={`Remove filter: ${chip.label}`}
                className="inline-flex h-7 max-w-[18rem] items-center gap-1.5 rounded-full bg-burgundy px-3 text-xs font-medium text-white transition-colors hover:bg-burgundy-deep"
              >
                <span className="truncate">{chip.label}</span>
                <X aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.25} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Search box for the review table (kept with the table: it does not change the charts). */
export function ReviewSearch({ state }: { state: ReviewPageState }) {
  const { setQuery } = useNavigationTransition();
  return (
    <SearchField
      key={state.q ?? ""}
      id="review-search"
      label="Search review titles and text"
      placeholder="e.g. breakout, holy grail"
      value={state.q ?? ""}
      onSearch={(q) => setQuery(toReviewPageSearchParams(withReviewChanges(state, { q })))}
    />
  );
}
