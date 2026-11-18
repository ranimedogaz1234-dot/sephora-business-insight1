import { describe, expect, it } from "vitest";
import {
  activeFilters,
  clearFilter,
  defaultRankYear,
  hasReviewFilters,
  parseFilters,
  periodBounds,
  toApiParams,
  toSearchParams,
  type FilterDomain,
} from "@/lib/filters";

// Synthetic domain mirroring the dataset's shape (final year is partial).
const domain: FilterDomain = {
  years: [2019, 2020, 2021, 2022, 2023],
  dateMax: "2023-03-21",
  brands: ["Alpha Labs", "Beta Botanics", "Dr. Jart+"],
  subcategories: ["Cleansers", "Moisturizers"],
};

describe("parseFilters", () => {
  it("defaults to all time and the latest complete ranking year", () => {
    const f = parseFilters({}, domain);
    expect(f).toEqual({ period: "all", rankYear: 2022, brand: undefined, subcategory: undefined });
    expect(hasReviewFilters(f)).toBe(false);
  });

  it("uses the last year when it is complete", () => {
    expect(defaultRankYear({ ...domain, dateMax: "2023-12-31" })).toBe(2023);
  });

  it("reads a single calendar year, brand and subcategory", () => {
    const f = parseFilters(
      { period: "year", year: "2021", brand: "Dr. Jart+", subcategory: "Cleansers", rank_year: "2020" },
      domain,
    );
    expect(f).toEqual({
      period: "year",
      year: 2021,
      brand: "Dr. Jart+",
      subcategory: "Cleansers",
      rankYear: 2020,
    });
  });

  it("drops values that do not exist in the data", () => {
    const f = parseFilters(
      { period: "year", year: "1999", brand: "Unknown", subcategory: "Nope", rank_year: "abcd" },
      domain,
    );
    expect(f).toEqual({ period: "all", rankYear: 2022, brand: undefined, subcategory: undefined });
  });

  it("normalises a reversed year range and takes the first of repeated params", () => {
    const f = parseFilters({ period: "range", from: "2022", to: ["2020", "2021"] }, domain);
    expect(f).toMatchObject({ period: "range", from: 2020, to: 2022 });
  });
});

describe("periodBounds / toApiParams", () => {
  it("maps 'last 12 months' to the 12 months ending at the last review", () => {
    expect(periodBounds({ period: "last12", rankYear: 2022 }, domain)).toEqual({
      date_from: "2022-03-22",
      date_to: "2023-03-21",
    });
  });

  it("maps a year and a range to inclusive calendar bounds", () => {
    expect(periodBounds({ period: "year", year: 2020, rankYear: 2022 }, domain)).toEqual({
      date_from: "2020-01-01",
      date_to: "2020-12-31",
    });
    expect(periodBounds({ period: "range", from: 2019, to: 2021, rankYear: 2022 }, domain)).toEqual({
      date_from: "2019-01-01",
      date_to: "2021-12-31",
    });
  });

  it("builds API params without catalogue-only fields", () => {
    const params = toApiParams(
      { period: "all", brand: "Alpha Labs", subcategory: "Cleansers", rankYear: 2021 },
      domain,
    );
    expect(params).toEqual({ brand: ["Alpha Labs"], subcategory: ["Cleansers"] });
    expect(params).not.toHaveProperty("rankYear");
  });
});

describe("toSearchParams", () => {
  it("round-trips through the URL and omits defaults", () => {
    const f = parseFilters({ period: "range", from: "2019", to: "2021", brand: "Dr. Jart+" }, domain);
    const qs = toSearchParams(f, domain);
    expect(qs.toString()).toBe("period=range&from=2019&to=2021&brand=Dr.+Jart%2B");
    expect(parseFilters(Object.fromEntries(qs), domain)).toEqual(f);
    expect(toSearchParams(parseFilters({}, domain), domain).toString()).toBe("");
  });

  it("keeps a non-default ranking year", () => {
    const f = { ...parseFilters({}, domain), rankYear: 2019 };
    expect(toSearchParams(f, domain).toString()).toBe("rank_year=2019");
  });
});

describe("active filter chips", () => {
  it("lists and clears each active filter independently", () => {
    const f = parseFilters({ period: "year", year: "2021", brand: "Alpha Labs" }, domain);
    expect(activeFilters(f, domain)).toEqual([
      { key: "period", label: "2021" },
      { key: "brand", label: "Alpha Labs" },
    ]);
    const noPeriod = clearFilter(f, "period");
    expect(noPeriod.period).toBe("all");
    expect(noPeriod.brand).toBe("Alpha Labs");
    expect(clearFilter(f, "brand").brand).toBeUndefined();
  });
});
