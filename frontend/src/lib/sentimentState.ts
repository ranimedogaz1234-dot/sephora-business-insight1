/**
 * AI Sentiment page state (/sentiment), kept in the URL and validated against the review
 * domain. Filters scope every figure; the breakdown options only affect the breakdown table.
 */
import type { Granularity, ReviewFilterParams, SentimentDimension, SentimentSort } from "@/lib/api/types";
import type { RawSearchParams } from "@/lib/filters";

export const MIN_CLASSIFIED_OPTIONS = [20, 50, 100, 500] as const;
export const DIMENSIONS: SentimentDimension[] = ["brand", "subcategory", "product"];
export const SORTS: { value: SentimentSort; label: string }[] = [
  { value: "classified", label: "Most classified reviews" },
  { value: "negative_share", label: "Highest negative share" },
  { value: "positive_share", label: "Highest positive share" },
  { value: "net", label: "Best net sentiment" },
];

export interface SentimentState {
  subcategory?: string;
  brand?: string;
  year?: number;
  by: SentimentDimension;
  sort: SentimentSort;
  min: number;
  grain: Granularity;
}

export interface SentimentDomain {
  brands: string[];
  subcategories: string[];
  years: number[];
}

export const DEFAULT_SENTIMENT_STATE: SentimentState = { by: "brand", sort: "classified", min: 50, grain: "year" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseSentimentState(sp: RawSearchParams, d: SentimentDomain): SentimentState {
  const sub = first(sp.subcategory);
  const brand = first(sp.brand);
  const year = Number(first(sp.year));
  const by = first(sp.by) as SentimentDimension;
  const sort = first(sp.sort) as SentimentSort;
  const min = Number(first(sp.min));
  const grain = first(sp.grain);
  return {
    subcategory: sub && d.subcategories.includes(sub) ? sub : undefined,
    brand: brand && d.brands.includes(brand) ? brand : undefined,
    year: d.years.includes(year) ? year : undefined,
    by: DIMENSIONS.includes(by) ? by : DEFAULT_SENTIMENT_STATE.by,
    sort: SORTS.some((s) => s.value === sort) ? sort : DEFAULT_SENTIMENT_STATE.sort,
    min: (MIN_CLASSIFIED_OPTIONS as readonly number[]).includes(min) ? min : DEFAULT_SENTIMENT_STATE.min,
    grain: grain === "month" || grain === "quarter" ? grain : "year",
  };
}

export function toSentimentSearchParams(s: SentimentState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.subcategory) p.set("subcategory", s.subcategory);
  if (s.brand) p.set("brand", s.brand);
  if (s.year) p.set("year", String(s.year));
  if (s.by !== DEFAULT_SENTIMENT_STATE.by) p.set("by", s.by);
  if (s.sort !== DEFAULT_SENTIMENT_STATE.sort) p.set("sort", s.sort);
  if (s.min !== DEFAULT_SENTIMENT_STATE.min) p.set("min", String(s.min));
  if (s.grain !== "year") p.set("grain", s.grain);
  return p;
}

export function toSentimentFilters(s: SentimentState): ReviewFilterParams {
  return {
    subcategory: s.subcategory ? [s.subcategory] : undefined,
    brand: s.brand ? [s.brand] : undefined,
    date_from: s.year ? `${s.year}-01-01` : undefined,
    date_to: s.year ? `${s.year}-12-31` : undefined,
  };
}

export const hasSentimentFilters = (s: SentimentState) => !!(s.subcategory || s.brand || s.year);

export function sentimentHref(s: SentimentState, changes: Partial<SentimentState>): string {
  const qs = toSentimentSearchParams({ ...s, ...changes }).toString();
  return qs ? `/sentiment?${qs}` : "/sentiment";
}
