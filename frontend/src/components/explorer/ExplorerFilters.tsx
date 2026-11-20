"use client";

import { RotateCcw } from "lucide-react";
import type { DatasetTable } from "@/lib/api/types";
import {
  PRODUCT_SORTS,
  RECORD_SORTS,
  hasExplorerFilters,
  toExplorerSearchParams,
  withExplorerChanges,
  type ExplorerState,
} from "@/lib/explorerState";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";
import { SearchField } from "@/components/ui/SearchField";
import { Select } from "@/components/ui/Select";

const DATASETS: { value: DatasetTable; label: string }[] = [
  { value: "products", label: "Product catalogue" },
  { value: "reviews", label: "Review records" },
];

interface ExplorerFiltersProps {
  state: ExplorerState;
  categories: string[];
  subcategories: string[];
}

export function ExplorerFilters({ state, categories, subcategories }: ExplorerFiltersProps) {
  const { setQuery, isPending } = useNavigationTransition();
  const change = (changes: Partial<ExplorerState>) => setQuery(toExplorerSearchParams(withExplorerChanges(state, changes)));
  const sorts = state.ds === "products" ? PRODUCT_SORTS : RECORD_SORTS;

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Dataset" className="flex w-full rounded-md border border-line p-0.5 sm:w-fit">
        {DATASETS.map((d) => (
          <button
            key={d.value}
            type="button"
            aria-pressed={state.ds === d.value}
            onClick={() => change({ ds: d.value })}
            className={`h-8 flex-1 rounded px-3 text-sm transition-colors sm:flex-none ${
              state.ds === d.value ? "bg-soft-pink font-medium text-burgundy" : "text-ink-2 hover:text-charcoal"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap" role="group" aria-label="Record filters">
        <div className="col-span-2 sm:col-span-1">
          <SearchField
            key={`${state.ds}-${state.q ?? ""}`}
            id="explorer-search"
            label={state.ds === "products" ? "Search product names and brands" : "Search review titles and text"}
            placeholder={state.ds === "products" ? "e.g. retinol, Drunk Elephant" : "e.g. sensitive skin"}
            value={state.q ?? ""}
            onSearch={(q) => change({ q })}
          />
        </div>

        {state.ds === "products" ? (
          <Select
            label="Category"
            value={state.category ?? ""}
            onChange={(v) => change({ category: v || undefined })}
            width="sm:w-44"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        ) : (
          <>
            <Select
              label="Skincare subcategory"
              value={state.subcategory ?? ""}
              onChange={(v) => change({ subcategory: v || undefined })}
              width="sm:w-48"
            >
              <option value="">All subcategories</option>
              {subcategories.map((c) => (
                <option key={c} value={c}>
                  {c}
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
          </>
        )}

        <Select label="Sort by" value={state.sort} onChange={(v) => change({ sort: v })} width="sm:w-52">
          {Object.entries(sorts).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </Select>

        {hasExplorerFilters(state) && (
          <button
            type="button"
            onClick={() => setQuery(toExplorerSearchParams({ ds: state.ds, sort: state.sort, page: 1 }))}
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
    </div>
  );
}
