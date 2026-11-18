import type { Granularity, HeatmapCell, TrendPoint } from "@/lib/api/types";

export interface PeriodRow {
  period: string;
  start: string;
  reviewCount: number;
  averageRating: number | null;
}

/**
 * Roll monthly points up to quarters or years. Averages are review-weighted
 * (sum of ratings / reviews), never an average of monthly averages.
 */
export function aggregateTrend(points: TrendPoint[], granularity: Granularity): PeriodRow[] {
  const groups = new Map<string, { start: string; count: number; ratingSum: number }>();
  for (const p of points) {
    const [y, m] = p.period_start.split("-").map(Number);
    let key: string;
    let start: string;
    if (granularity === "year") {
      key = String(y);
      start = `${y}-01-01`;
    } else if (granularity === "quarter") {
      const q = Math.floor((m - 1) / 3) + 1;
      key = `${y}-Q${q}`;
      start = `${y}-${String((q - 1) * 3 + 1).padStart(2, "0")}-01`;
    } else {
      key = p.period;
      start = p.period_start;
    }
    const g = groups.get(key) ?? { start, count: 0, ratingSum: 0 };
    g.count += p.review_count;
    g.ratingSum += (p.average_rating ?? 0) * p.review_count;
    groups.set(key, g);
  }
  return [...groups.entries()].map(([period, g]) => ({
    period,
    start: g.start,
    reviewCount: g.count,
    averageRating: g.count ? Math.round((g.ratingSum / g.count) * 1e4) / 1e4 : null,
  }));
}

/** Round up to a "nice" number (1, 2, 2.5, 5 × 10^n) for readable legend bounds. */
export function niceCeil(v: number): number {
  if (v <= 0) return 0;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  const step = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return step * p;
}

/**
 * Class breaks for the heatmap on a square-root-style power scale up to the maximum:
 * low-volume early years stay distinguishable while the peak remains the darkest step.
 * Returns ascending lower bounds of classes 2..k (k-1 breaks), rounded to nice numbers.
 */
export function powerBreaks(values: number[], k: number): number[] {
  const max = Math.max(0, ...values);
  if (max <= 0) return [];
  const breaks: number[] = [];
  for (let i = 1; i < k; i++) {
    const b = niceCeil(max * (i / k) ** 2);
    if (b > (breaks[breaks.length - 1] ?? 0) && b < max) breaks.push(b);
  }
  return breaks;
}

/** Ramp index for a value: -1 for zero (neutral), else 0..breaks.length. */
export function binIndex(value: number, breaks: number[]): number {
  if (value <= 0) return -1;
  let i = 0;
  while (i < breaks.length && value >= breaks[i]) i++;
  return i;
}

export function heatmapGrid(cells: HeatmapCell[]): Map<number, number[]> {
  const grid = new Map<number, number[]>();
  for (const c of cells) {
    const row = grid.get(c.year) ?? Array<number>(12).fill(0);
    row[c.month - 1] = c.review_count;
    grid.set(c.year, row);
  }
  return grid;
}
