import { describe, expect, it } from "vitest";
import { aggregateTrend, binIndex, heatmapGrid, niceCeil, powerBreaks } from "@/lib/aggregate";
import type { TrendPoint } from "@/lib/api/types";

const month = (period: string, count: number, avg: number | null): TrendPoint => ({
  period,
  period_start: `${period}-01`,
  review_count: count,
  average_rating: avg,
  five_star_share: null,
});

const points = [
  month("2021-11", 10, 5),
  month("2021-12", 30, 3),
  month("2022-01", 0, null),
  month("2022-02", 20, 4),
];

describe("aggregateTrend", () => {
  it("keeps monthly points as they are", () => {
    expect(aggregateTrend(points, "month").map((r) => r.reviewCount)).toEqual([10, 30, 0, 20]);
  });

  it("weights quarterly and yearly averages by review count", () => {
    const quarters = aggregateTrend(points, "quarter");
    expect(quarters).toEqual([
      { period: "2021-Q4", start: "2021-10-01", reviewCount: 40, averageRating: 3.5 },
      { period: "2022-Q1", start: "2022-01-01", reviewCount: 20, averageRating: 4 },
    ]);
    const years = aggregateTrend(points, "year");
    expect(years.map((y) => [y.period, y.reviewCount, y.averageRating])).toEqual([
      ["2021", 40, 3.5],
      ["2022", 20, 4],
    ]);
  });

  it("reports no average for an empty period", () => {
    expect(aggregateTrend([month("2020-01", 0, null)], "year")[0].averageRating).toBeNull();
  });
});

describe("heatmap scale", () => {
  it("rounds breaks to nice numbers", () => {
    expect([niceCeil(0), niceCeil(7), niceCeil(13), niceCeil(2_300), niceCeil(4_100), niceCeil(23_924)]).toEqual([
      0, 10, 20, 2_500, 5_000, 25_000,
    ]);
  });

  it("produces strictly increasing breaks below the maximum", () => {
    const breaks = powerBreaks([0, 12, 950, 3_400, 23_924], 5);
    expect(breaks).toEqual([1_000, 5_000, 10_000, 20_000]);
    expect(powerBreaks([0, 0], 5)).toEqual([]);
  });

  it("maps zero to the neutral bin and values to ramp steps", () => {
    const breaks = [1_000, 5_000, 10_000, 20_000];
    expect([0, 1, 999, 1_000, 7_500, 23_924].map((v) => binIndex(v, breaks))).toEqual([-1, 0, 0, 1, 2, 4]);
  });

  it("builds a 12-month row per year", () => {
    const grid = heatmapGrid([
      { year: 2022, month: 1, review_count: 5 },
      { year: 2022, month: 12, review_count: 7 },
    ]);
    expect(grid.get(2022)).toEqual([5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7]);
  });
});
