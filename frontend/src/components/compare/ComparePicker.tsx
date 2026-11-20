"use client";

import Link from "next/link";
import { Plus, X } from "lucide-react";
import type { Page, ProductItem } from "@/lib/api/types";
import { formatInteger, formatUsd } from "@/lib/format";
import {
  MAX_COMPARE,
  addProduct,
  compareHref,
  removeProduct,
  toCompareSearchParams,
  type CompareState,
} from "@/lib/compareState";
import { compareColors } from "@/lib/theme";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";
import { SearchField } from "@/components/ui/SearchField";

export interface SelectedProduct {
  product_id: string;
  product_name: string;
  brand_name: string;
}

interface ComparePickerProps {
  state: CompareState;
  selected: SelectedProduct[];
  /** Finder results for state.find (server-rendered), if a search is active. */
  results?: Page<ProductItem> | null;
  resultsError?: string;
}

export function ComparePicker({ state, selected, results, resultsError }: ComparePickerProps) {
  const { setQuery, isPending } = useNavigationTransition();
  const full = state.ids.length >= MAX_COMPARE;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-medium text-ink-3">
          Compared products ({state.ids.length} of {MAX_COMPARE})
        </p>
        {selected.length === 0 ? (
          <p className="mt-1.5 text-sm text-ink-2">No products selected yet. Search below to add two to four.</p>
        ) : (
          <ul className="mt-1.5 flex flex-wrap gap-2" aria-label="Compared products">
            {selected.map((p) => {
              const slot = state.ids.indexOf(p.product_id);
              return (
                <li key={p.product_id}>
                  <span className="inline-flex h-8 max-w-[20rem] items-center gap-2 rounded-full border border-line bg-white pl-2.5 pr-1 text-xs text-charcoal">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: compareColors[slot] }}
                    />
                    <span className="truncate" title={`${p.product_name} · ${p.brand_name}`}>
                      {p.product_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuery(toCompareSearchParams(removeProduct(state, p.product_id)))}
                      aria-label={`Remove ${p.product_name} from the comparison`}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-light-gray hover:text-charcoal"
                    >
                      <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <SearchField
          key={state.find ?? ""}
          id="compare-search"
          label="Find products to compare"
          placeholder="e.g. vitamin c serum, LANEIGE"
          value={state.find ?? ""}
          onSearch={(find) => setQuery(toCompareSearchParams({ ...state, find }))}
          width="sm:w-80"
        />
        <span aria-live="polite" className="h-9 text-xs leading-9 text-ink-3">
          {isPending ? "Updating…" : ""}
        </span>
      </div>

      {state.find && (
        <div className="rounded-lg border border-line">
          {resultsError ? (
            <p role="alert" className="px-4 py-3 text-sm text-ink-2">
              Search is unavailable: {resultsError}
            </p>
          ) : !results || results.total === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-2">No products match “{state.find}”.</p>
          ) : (
            <>
              <ul className="divide-y divide-line" aria-label="Search results">
                {results.items.map((p) => {
                  const added = state.ids.includes(p.product_id);
                  return (
                    <li key={p.product_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-charcoal" title={p.product_name}>
                          {p.product_name}
                        </p>
                        <p className="truncate text-xs text-ink-3">
                          {p.brand_name} · {p.secondary_category ?? p.primary_category} · {formatUsd(p.price_usd)} ·{" "}
                          {p.review_record_count
                            ? `${formatInteger(p.review_record_count)} review records`
                            : "no review records"}
                        </p>
                      </div>
                      {added ? (
                        <span className="shrink-0 text-xs text-ink-3">Added</span>
                      ) : (
                        <Link
                          href={compareHref(addProduct(state, p.product_id))}
                          scroll={false}
                          aria-disabled={full}
                          tabIndex={full ? -1 : undefined}
                          aria-label={`Add ${p.product_name} to the comparison`}
                          className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                            full
                              ? "pointer-events-none border-line text-ink-3"
                              : "border-burgundy text-burgundy hover:bg-soft-pink"
                          }`}
                        >
                          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                          Add
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="border-t border-line px-4 py-2 text-[11px] text-ink-3">
                {results.total > results.items.length
                  ? `Showing the ${results.items.length} most reviewed of ${formatInteger(results.total)} matches. Refine the search to narrow it.`
                  : `${formatInteger(results.total)} ${results.total === 1 ? "match" : "matches"}.`}
                {full ? ` You are comparing ${MAX_COMPARE} products; remove one to add another.` : ""}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
