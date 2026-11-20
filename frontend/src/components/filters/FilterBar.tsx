"use client";

import { RotateCcw, X } from "lucide-react";
import type { NamedCount } from "@/lib/api/types";
import { formatInteger } from "@/lib/format";
import {
  activeFilters,
  clearFilter,
  hasReviewFilters,
  toSearchParams,
  type DashboardFilters,
  type FilterDomain,
} from "@/lib/filters";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";
import { Select } from "@/components/ui/Select";

interface FilterBarProps {
  filters: DashboardFilters;
  domain: FilterDomain;
  brands: NamedCount[];
  subcategories: NamedCount[];
}

export function FilterBar({ filters, domain, brands, subcategories }: FilterBarProps) {
  const { setQuery, isPending } = useNavigationTransition();
  const apply = (next: DashboardFilters) => setQuery(toSearchParams(next, domain));
  const years = [...domain.years].reverse();
  const lastYear = domain.years[domain.years.length - 1];
  const partialLast = !domain.dateMax.endsWith("-12-31");

  const periodValue =
    filters.period === "year" ? `year:${filters.year}` : filters.period === "range" ? "range" : filters.period;

  const onPeriod = (v: string) => {
    if (v === "all" || v === "last12") apply({ ...filters, period: v, year: undefined, from: undefined, to: undefined });
    else if (v === "range")
      apply({ ...filters, period: "range", year: undefined, from: domain.years[0], to: lastYear });
    else apply({ ...filters, period: "year", year: Number(v.slice(5)), from: undefined, to: undefined });
  };

  const chips = activeFilters(filters, domain);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap"
        role="group"
        aria-label="Review filters"
      >
        <Select label="Period" value={periodValue} onChange={onPeriod} width="sm:w-48">
          <option value="all">All time</option>
          <option value="last12">Last 12 months of data</option>
          <optgroup label="Calendar year">
            {years.map((y) => (
              <option key={y} value={`year:${y}`}>
                {y}
                {y === lastYear && partialLast ? " (partial)" : ""}
              </option>
            ))}
          </optgroup>
          <option value="range">Custom year range…</option>
        </Select>

        {filters.period === "range" && (
          <>
            <Select
              label="From"
              value={String(filters.from ?? domain.years[0])}
              onChange={(v) => apply({ ...filters, from: Number(v) })}
              width="sm:w-28"
            >
              {domain.years.map((y) => (
                <option key={y} value={y} disabled={!!filters.to && y > filters.to}>
                  {y}
                </option>
              ))}
            </Select>
            <Select
              label="To"
              value={String(filters.to ?? lastYear)}
              onChange={(v) => apply({ ...filters, to: Number(v) })}
              width="sm:w-28"
            >
              {domain.years.map((y) => (
                <option key={y} value={y} disabled={!!filters.from && y < filters.from}>
                  {y}
                </option>
              ))}
            </Select>
          </>
        )}

        <Select
          label="Skincare subcategory"
          value={filters.subcategory ?? ""}
          onChange={(v) => apply({ ...filters, subcategory: v || undefined })}
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
          label="Brand"
          value={filters.brand ?? ""}
          onChange={(v) => apply({ ...filters, brand: v || undefined })}
          width="sm:w-56"
        >
          <option value="">All brands</option>
          {brands.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name} ({formatInteger(b.count)})
            </option>
          ))}
        </Select>

        {hasReviewFilters(filters) && (
          <button
            type="button"
            onClick={() =>
              apply({ ...filters, period: "all", year: undefined, from: undefined, to: undefined, brand: undefined, subcategory: undefined })
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

      {chips.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => apply(clearFilter(filters, chip.key))}
                aria-label={`Remove filter: ${chip.label}`}
                className="inline-flex h-7 items-center gap-1.5 rounded-full bg-burgundy px-3 text-xs font-medium text-white transition-colors hover:bg-burgundy-deep"
              >
                {chip.label}
                <X aria-hidden className="h-3 w-3" strokeWidth={2.25} />
              </button>
            </li>
          ))}
          <li className="text-xs text-ink-3">
            Review figures are filtered · catalogue figures always cover all products
          </li>
        </ul>
      )}
    </div>
  );
}
