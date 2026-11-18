"use client";

import { ChevronDown } from "lucide-react";
import { toSearchParams, type DashboardFilters, type FilterDomain } from "@/lib/filters";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";

/** Year selector for the "most reviewed products by year" ranking (kept in the URL). */
export function YearSelect({ filters, domain }: { filters: DashboardFilters; domain: FilterDomain }) {
  const { setQuery } = useNavigationTransition();
  const partialLast = !domain.dateMax.endsWith("-12-31");
  const last = domain.years[domain.years.length - 1];
  return (
    <div className="relative">
      <label htmlFor="rank-year" className="sr-only">
        Ranking year
      </label>
      <select
        id="rank-year"
        value={filters.rankYear}
        onChange={(e) => setQuery(toSearchParams({ ...filters, rankYear: Number(e.target.value) }, domain))}
        className="h-8 appearance-none rounded-md border border-line bg-white pl-3 pr-8 text-sm font-medium text-burgundy transition-colors hover:border-line-strong focus:border-burgundy focus:outline-none"
      >
        {[...domain.years].reverse().map((y) => (
          <option key={y} value={y}>
            {y}
            {y === last && partialLast ? " (partial)" : ""}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
        strokeWidth={1.75}
      />
    </div>
  );
}
