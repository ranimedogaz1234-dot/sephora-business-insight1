"use client";

import { RotateCcw } from "lucide-react";
import type { NamedCount } from "@/lib/api/types";
import { formatInteger } from "@/lib/format";
import { hasSentimentFilters, toSentimentSearchParams, type SentimentState } from "@/lib/sentimentState";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";
import { Select } from "@/components/ui/Select";

export function SentimentFilterBar({
  state,
  subcategories,
  brands,
  years,
}: {
  state: SentimentState;
  subcategories: NamedCount[];
  brands: NamedCount[];
  years: number[];
}) {
  const { setQuery, isPending } = useNavigationTransition();
  const change = (c: Partial<SentimentState>) => setQuery(toSentimentSearchParams({ ...state, ...c }));
  return (
    <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap" role="group" aria-label="Sentiment filters">
      <Select label="Skincare subcategory" value={state.subcategory ?? ""} onChange={(v) => change({ subcategory: v || undefined })} width="sm:w-48">
        <option value="">All subcategories</option>
        {subcategories.map((s) => (
          <option key={s.name} value={s.name}>
            {s.name} ({formatInteger(s.count)})
          </option>
        ))}
      </Select>
      <Select label="Brand" value={state.brand ?? ""} onChange={(v) => change({ brand: v || undefined })} width="sm:w-48">
        <option value="">All brands</option>
        {brands.map((b) => (
          <option key={b.name} value={b.name}>
            {b.name}
          </option>
        ))}
      </Select>
      <Select label="Year" value={state.year ? String(state.year) : ""} onChange={(v) => change({ year: v ? Number(v) : undefined })} width="sm:w-32">
        <option value="">All years</option>
        {[...years].reverse().map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
      {hasSentimentFilters(state) && (
        <button
          type="button"
          onClick={() => change({ subcategory: undefined, brand: undefined, year: undefined })}
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
  );
}
