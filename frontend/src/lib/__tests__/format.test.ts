import { describe, expect, it } from "vitest";
import {
  formatCompact,
  formatInteger,
  formatMonthYear,
  formatPercent,
  formatRating,
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
});
