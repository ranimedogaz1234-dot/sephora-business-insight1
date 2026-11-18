import { describe, expect, it } from "vitest";
import {
  axisFormatter,
  formatCompact,
  formatDate,
  formatInteger,
  formatMonthYear,
  formatPercent,
  formatRating,
  formatUsd,
  plural,
} from "@/lib/format";

describe("format helpers", () => {
  it("formats integers with thousands separators", () => {
    expect(formatInteger(1094187)).toBe("1,094,187");
  });
  it("formats compact numbers", () => {
    expect(formatCompact(3685250)).toBe("3.7M");
  });
  it("formats ratios as percentages", () => {
    expect(formatPercent(0.6386)).toBe("63.9%");
  });
  it("formats ratings to two decimals", () => {
    expect(formatRating(4.2991)).toBe("4.30");
  });
  it("formats ISO dates as month and year, independent of timezone", () => {
    expect(formatMonthYear("2008-08-28")).toBe("Aug 2008");
    expect(formatMonthYear(null)).toBe("—");
  });
  it("formats full dates and US dollars", () => {
    expect(formatDate("2023-03-21")).toBe("Mar 21, 2023");
    expect(formatUsd(35)).toBe("$35");
    expect(formatUsd(1900)).toBe("$1,900");
  });
  it("uses one number style per axis", () => {
    const small = axisFormatter(2_000);
    const large = axisFormatter(24_000);
    expect([0, 1_000, 2_000].map(small)).toEqual(["0", "1,000", "2,000"]);
    expect([0, 6_000, 24_000].map(large)).toEqual(["0", "6K", "24K"]);
  });
  it("pluralises counts", () => {
    expect(plural(1, "brand")).toBe("1 brand");
    expect(plural(142, "brand")).toBe("142 brands");
    expect(plural(2351, "Skincare product")).toBe("2,351 Skincare products");
  });
});
