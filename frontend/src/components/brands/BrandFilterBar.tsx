"use client";

import { RotateCcw } from "lucide-react";
import type { NamedCount } from "@/lib/api/types";
import { formatInteger } from "@/lib/format";
import {
  DEFAULT_BRAND_STATE,
  MIN_REVIEW_OPTIONS,
  toBrandSearchParams,
  withBrandChanges,
  type BrandPageState,
} from "@/lib/brandFilters";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";
import { Select } from "@/components/ui/Select";

interface BrandFilterBarProps {
  state: BrandPageState;
  brands: string[];
  subcategories: NamedCount[];
}

export function BrandFilterBar({ state, brands, subcategories }: BrandFilterBarProps) {
  const { setQuery, isPending } = useNavigationTransition();
  const change = (changes: Partial<BrandPageState>) => setQuery(toBrandSearchParams(withBrandChanges(state, changes)));
  const changed =
    !!state.subcategory || !!state.brand || !!state.category || state.minReviews !== DEFAULT_BRAND_STATE.minReviews;

  return (
    <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap" role="group" aria-label="Brand and category filters">
      <div className="col-span-2 sm:col-span-1">
        <Select
          label="Focus brand"
          value={state.brand ?? ""}
          onChange={(v) => change({ brand: v || undefined })}
          width="sm:w-56"
        >
          <option value="">No brand selected</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>
      </div>

      <Select
        label="Skincare subcategory (reviews)"
        value={state.subcategory ?? ""}
        onChange={(v) => change({ subcategory: v || undefined })}
        width="sm:w-52"
      >
        <option value="">All subcategories</option>
        {subcategories.map((s) => (
          <option key={s.name} value={s.name}>
            {s.name} ({formatInteger(s.count)})
          </option>
        ))}
      </Select>

      <Select
        label="Minimum reviews to rank"
        value={String(state.minReviews)}
        onChange={(v) => change({ minReviews: Number(v) })}
        width="sm:w-44"
      >
        {MIN_REVIEW_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {formatInteger(n)}+ reviews
          </option>
        ))}
      </Select>

      {changed && (
        <button
          type="button"
          onClick={() =>
            setQuery(
              toBrandSearchParams({ ...DEFAULT_BRAND_STATE, q: state.q, sort: state.sort, order: state.order, page: state.page }),
            )
          }
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
