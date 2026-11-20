"use client";

import { useState } from "react";
import { RotateCcw, X } from "lucide-react";
import type { NamedCount } from "@/lib/api/types";
import { formatInteger } from "@/lib/format";
import {
  MIN_RATING_OPTIONS,
  SORT_PRESETS,
  clearAllProductFilters,
  clearProductChip,
  hasProductFilters,
  productChips,
  toProductSearchParams,
  withChanges,
  type ProductFilters,
} from "@/lib/productFilters";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";
import { SearchField } from "@/components/ui/SearchField";
import { Select } from "@/components/ui/Select";

export { SEARCH_DEBOUNCE_MS } from "@/components/ui/SearchField";

interface ProductFilterBarProps {
  filters: ProductFilters;
  categories: NamedCount[];
  subcategories: Record<string, NamedCount[]>;
  brands: string[];
}

/** Min/max price inputs, applied together on blur or Enter. */
function PriceRange({
  min,
  max,
  onApply,
}: {
  min?: number;
  max?: number;
  onApply: (min: number | undefined, max: number | undefined) => void;
}) {
  const [lo, setLo] = useState(min === undefined ? "" : String(min));
  const [hi, setHi] = useState(max === undefined ? "" : String(max));
  const parse = (v: string) => {
    const n = Number(v);
    return v.trim() === "" || !Number.isFinite(n) || n < 0 ? undefined : Math.round(n * 100) / 100;
  };
  const apply = () => {
    let a = parse(lo);
    let b = parse(hi);
    if (a !== undefined && b !== undefined && a > b) [a, b] = [b, a];
    if (a !== min || b !== max) onApply(a, b);
  };
  const input =
    "h-9 w-full rounded-md border border-line bg-white px-2.5 text-sm tabular-nums text-charcoal placeholder:text-ink-3 transition-colors hover:border-line-strong focus:border-burgundy focus:outline-none";
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 text-[11px] font-medium text-ink-3">Price (USD)</legend>
      <div className="flex items-center gap-1.5 sm:w-48">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          aria-label="Minimum price"
          placeholder="Min"
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
          type="number"
          inputMode="decimal"
          min={0}
          aria-label="Maximum price"
          placeholder="Max"
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

export function ProductFilterBar({ filters, categories, subcategories, brands }: ProductFilterBarProps) {
  const { setQuery, isPending } = useNavigationTransition();
  const apply = (next: ProductFilters) => setQuery(toProductSearchParams(next));
  const change = (changes: Partial<ProductFilters>) => apply(withChanges(filters, changes));
  const subs = filters.category ? (subcategories[filters.category] ?? []) : [];
  const preset = SORT_PRESETS.find((p) => p.sort === filters.sort && p.order === filters.order);
  const chips = productChips(filters);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap" role="group" aria-label="Product filters">
        <div className="col-span-2 sm:col-span-1">
          {/* Remount when the URL's search changes (e.g. a chip is removed) to resync the text. */}
          <SearchField
            key={filters.q ?? ""}
            id="product-search"
            label="Search products or brands"
            placeholder="e.g. vitamin c, LANEIGE"
            value={filters.q ?? ""}
            onSearch={(q) => change({ q })}
          />
        </div>

        <Select
          label="Category"
          value={filters.category ?? ""}
          onChange={(v) => change({ category: v || undefined })}
          width="sm:w-40"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({formatInteger(c.count)})
            </option>
          ))}
        </Select>

        <Select
          label="Subcategory"
          value={filters.subcategory ?? ""}
          onChange={(v) => change({ subcategory: v || undefined })}
          width="sm:w-48"
          disabled={!filters.category}
        >
          <option value="">{filters.category ? "All subcategories" : "Choose a category first"}</option>
          {subs.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name} ({formatInteger(s.count)})
            </option>
          ))}
        </Select>

        <Select
          label="Brand"
          value={filters.brand ?? ""}
          onChange={(v) => change({ brand: v || undefined })}
          width="sm:w-48"
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </Select>

        <div className="col-span-2 sm:col-span-1">
          <PriceRange
            key={`${filters.priceMin ?? ""}-${filters.priceMax ?? ""}`}
            min={filters.priceMin}
            max={filters.priceMax}
            onApply={(priceMin, priceMax) => change({ priceMin, priceMax })}
          />
        </div>

        <Select
          label="Minimum rating"
          value={filters.minRating === undefined ? "" : String(filters.minRating)}
          onChange={(v) => change({ minRating: v ? Number(v) : undefined })}
          width="sm:w-36"
        >
          <option value="">Any rating</option>
          {MIN_RATING_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r.toFixed(1)} ★ and up
            </option>
          ))}
        </Select>

        <Select
          label="Sort by"
          value={preset?.value ?? "custom"}
          onChange={(v) => {
            const p = SORT_PRESETS.find((x) => x.value === v);
            if (p) change({ sort: p.sort, order: p.order });
          }}
          width="sm:w-48"
        >
          {!preset && (
            <option value="custom" disabled>
              Custom (column header)
            </option>
          )}
          {SORT_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>

        {hasProductFilters(filters) && (
          <button
            type="button"
            onClick={() => apply(clearAllProductFilters(filters))}
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
                onClick={() => apply(clearProductChip(filters, chip.key))}
                aria-label={`Remove filter: ${chip.label}`}
                className="inline-flex h-7 items-center gap-1.5 rounded-full bg-burgundy px-3 text-xs font-medium text-white transition-colors hover:bg-burgundy-deep"
              >
                {chip.label}
                <X aria-hidden className="h-3 w-3" strokeWidth={2.25} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
