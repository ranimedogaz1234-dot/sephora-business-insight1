/**
 * Product comparison state (/compare): selected product IDs in a stable order, the
 * product-finder search and the activity granularity. Kept in the URL so a comparison can
 * be shared; anything that is not a well-formed product ID is dropped.
 */
import type { RawSearchParams } from "@/lib/filters";
import { normaliseSearch } from "@/lib/search";

export const MIN_COMPARE = 2;
export const MAX_COMPARE = 4;
export const FINDER_PAGE_SIZE = 8;
const PRODUCT_ID = /^P\d{1,12}$/;

export type CompareGranularity = "year" | "quarter";

export interface CompareState {
  ids: string[];
  find?: string;
  grain: CompareGranularity;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Valid, distinct IDs in the order given, capped at four. */
export function parseIds(raw: string | undefined): string[] {
  if (!raw) return [];
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => PRODUCT_ID.test(s));
  return [...new Set(ids)].slice(0, MAX_COMPARE);
}

export function parseCompareState(sp: RawSearchParams): CompareState {
  return {
    ids: parseIds(first(sp.ids)),
    find: normaliseSearch(first(sp.find)),
    grain: first(sp.grain) === "quarter" ? "quarter" : "year",
  };
}

export function toCompareSearchParams(s: CompareState): URLSearchParams {
  const p = new URLSearchParams();
  if (s.ids.length) p.set("ids", s.ids.join(","));
  if (s.find) p.set("find", s.find);
  if (s.grain !== "year") p.set("grain", s.grain);
  return p;
}

export function compareHref(s: CompareState): string {
  const qs = toCompareSearchParams(s).toString();
  return qs ? `/compare?${qs}` : "/compare";
}

export function addProduct(s: CompareState, id: string): CompareState {
  if (s.ids.includes(id) || s.ids.length >= MAX_COMPARE || !PRODUCT_ID.test(id)) return s;
  return { ...s, ids: [...s.ids, id] };
}

export function removeProduct(s: CompareState, id: string): CompareState {
  return { ...s, ids: s.ids.filter((x) => x !== id) };
}

export const canCompare = (s: CompareState) => s.ids.length >= MIN_COMPARE;
