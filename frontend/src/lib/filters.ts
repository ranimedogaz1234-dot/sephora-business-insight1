/**
 * Global dashboard filters. The URL is the single source of truth, so every view is
 * shareable and the server renders exactly what the address bar says.
 *
 * Review filters scope every review-based figure. Catalogue figures (product counts,
 * categories, prices) are never filtered — they describe all 8,494 products.
 */
import type { ReviewFilterParams } from "@/lib/api/types";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export type Period = "all" | "last12" | "year" | "range";

export interface DashboardFilters {
  period: Period;
  /** Selected year for period=year, or range bounds for period=range. */
  year?: number;
  from?: number;
  to?: number;
  brand?: string;
  subcategory?: string;
  /** Year shown in the "most reviewed by year" ranking. */
  rankYear: number;
}

export interface FilterDomain {
  years: number[]; // ascending years that have review records
  dateMax: string; // last review date (YYYY-MM-DD)
  brands: string[];
  subcategories: string[];
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function intIn(value: string | undefined, allowed: number[]): number | undefined {
  if (!value || !/^\d{4}$/.test(value)) return undefined;
  const n = Number(value);
  return allowed.includes(n) ? n : undefined;
}

export function defaultRankYear(domain: FilterDomain): number {
  // Latest *complete* year: the final year in the data may be partial.
  const { years, dateMax } = domain;
  if (!years.length) return new Date().getUTCFullYear();
  const last = years[years.length - 1];
  return dateMax.endsWith("-12-31") || years.length === 1 ? last : years[years.length - 2];
}

export function parseFilters(sp: RawSearchParams, domain: FilterDomain): DashboardFilters {
  const rankYear = intIn(first(sp.rank_year), domain.years) ?? defaultRankYear(domain);
  const brand = first(sp.brand);
  const subcategory = first(sp.subcategory);
  const base = {
    rankYear,
    brand: brand && domain.brands.includes(brand) ? brand : undefined,
    subcategory:
      subcategory && domain.subcategories.includes(subcategory) ? subcategory : undefined,
  };

  const period = first(sp.period);
  if (period === "last12") return { ...base, period: "last12" };
  if (period === "year") {
    const year = intIn(first(sp.year), domain.years);
    if (year) return { ...base, period: "year", year };
  }
  if (period === "range") {
    let from = intIn(first(sp.from), domain.years);
    let to = intIn(first(sp.to), domain.years);
    if (from && to && from > to) [from, to] = [to, from];
    if (from || to) return { ...base, period: "range", from, to };
  }
  return { ...base, period: "all" };
}

function shiftYears(iso: string, years: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Inclusive date bounds for the selected period, or nothing for all time. */
export function periodBounds(
  f: DashboardFilters,
  domain: FilterDomain,
): { date_from?: string; date_to?: string } {
  switch (f.period) {
    case "last12":
      return { date_from: shiftYears(domain.dateMax, -1), date_to: domain.dateMax };
    case "year":
      return f.year ? { date_from: `${f.year}-01-01`, date_to: `${f.year}-12-31` } : {};
    case "range":
      return {
        date_from: f.from ? `${f.from}-01-01` : undefined,
        date_to: f.to ? `${f.to}-12-31` : undefined,
      };
    default:
      return {};
  }
}

export function toApiParams(f: DashboardFilters, domain: FilterDomain): ReviewFilterParams {
  return {
    ...periodBounds(f, domain),
    brand: f.brand ? [f.brand] : undefined,
    subcategory: f.subcategory ? [f.subcategory] : undefined,
  };
}

export function hasReviewFilters(f: DashboardFilters): boolean {
  return f.period !== "all" || !!f.brand || !!f.subcategory;
}

/** URL search params for a filter state (defaults omitted to keep URLs short). */
export function toSearchParams(f: DashboardFilters, domain: FilterDomain): URLSearchParams {
  const p = new URLSearchParams();
  if (f.period === "last12") p.set("period", "last12");
  if (f.period === "year" && f.year) {
    p.set("period", "year");
    p.set("year", String(f.year));
  }
  if (f.period === "range" && (f.from || f.to)) {
    p.set("period", "range");
    if (f.from) p.set("from", String(f.from));
    if (f.to) p.set("to", String(f.to));
  }
  if (f.brand) p.set("brand", f.brand);
  if (f.subcategory) p.set("subcategory", f.subcategory);
  if (f.rankYear !== defaultRankYear(domain)) p.set("rank_year", String(f.rankYear));
  return p;
}

export function periodLabel(f: DashboardFilters, domain: FilterDomain): string {
  switch (f.period) {
    case "last12": {
      const b = periodBounds(f, domain);
      return `Last 12 months of data (${b.date_from} – ${b.date_to})`;
    }
    case "year":
      return String(f.year);
    case "range":
      return `${f.from ?? domain.years[0]} – ${f.to ?? domain.years[domain.years.length - 1]}`;
    default:
      return "All time";
  }
}

export interface ActiveFilter {
  key: "period" | "brand" | "subcategory";
  label: string;
}

export function activeFilters(f: DashboardFilters, domain: FilterDomain): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  if (f.period !== "all") out.push({ key: "period", label: periodLabel(f, domain) });
  if (f.brand) out.push({ key: "brand", label: f.brand });
  if (f.subcategory) out.push({ key: "subcategory", label: f.subcategory });
  return out;
}

export function clearFilter(f: DashboardFilters, key: ActiveFilter["key"]): DashboardFilters {
  if (key === "period") return { ...f, period: "all", year: undefined, from: undefined, to: undefined };
  return { ...f, [key]: undefined };
}
