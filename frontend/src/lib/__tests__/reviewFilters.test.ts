import { describe, expect, it } from "vitest";
import {
  DEFAULT_REVIEW_STATE,
  clearAllReviewFilters,
  clearReviewChip,
  hasReviewPageFilters,
  parseReviewState,
  reviewChips,
  reviewHref,
  toReviewFilterParams,
  toReviewPageSearchParams,
  toReviewTableParams,
  validDate,
  withReviewChanges,
  type ReviewDomain,
} from "@/lib/reviewFilters";

// Synthetic domain — not real dataset values.
const domain: ReviewDomain = {
  brands: ["Alpha Labs", "Beta Botanics"],
  subcategories: ["Cleansers", "Moisturizers"],
  dateMin: "2019-03-10",
  dateMax: "2023-03-01",
};

describe("validDate", () => {
  it("accepts real dates inside the range", () => {
    expect(validDate("2021-06-15", domain)).toBe("2021-06-15");
  });
  it("rejects malformed and impossible dates", () => {
    expect(validDate("2021-6-15", domain)).toBeUndefined();
    expect(validDate("2021-02-30", domain)).toBeUndefined();
    expect(validDate("yesterday", domain)).toBeUndefined();
  });
  it("clamps dates to the dataset range", () => {
    expect(validDate("2001-01-01", domain)).toBe("2019-03-10");
    expect(validDate("2030-01-01", domain)).toBe("2023-03-01");
  });
});

describe("parseReviewState", () => {
  it("returns defaults for an empty URL", () => {
    expect(parseReviewState({}, domain)).toEqual({ ...DEFAULT_REVIEW_STATE, q: undefined });
  });

  it("parses every supported parameter", () => {
    const s = parseReviewState(
      {
        from: "2020-01-01",
        to: "2021-12-31",
        subcategory: "Cleansers",
        brand: "Alpha Labs",
        product: "P1001",
        rating: "4",
        recommended: "no",
        q: "  serum ",
        sort: "helpful",
        page: "3",
      },
      domain,
    );
    expect(s).toEqual({
      from: "2020-01-01",
      to: "2021-12-31",
      subcategory: "Cleansers",
      brand: "Alpha Labs",
      product: "P1001",
      rating: 4,
      recommended: false,
      q: "serum",
      sort: "helpful",
      page: 3,
    });
  });

  it("drops values outside the domain instead of sending them to the API", () => {
    const s = parseReviewState(
      {
        brand: "Unknown",
        subcategory: "Fragrance",
        product: "P1; DROP",
        rating: "6",
        recommended: "maybe",
        q: "x",
        sort: "__proto__",
        page: "-2",
      },
      domain,
    );
    expect(s).toEqual({ ...DEFAULT_REVIEW_STATE, q: undefined, recommended: undefined });
  });

  it("swaps an inverted date range", () => {
    const s = parseReviewState({ from: "2022-01-01", to: "2020-01-01" }, domain);
    expect([s.from, s.to]).toEqual(["2020-01-01", "2022-01-01"]);
  });
});

describe("API and URL params", () => {
  const s = parseReviewState(
    { brand: "Alpha Labs", rating: "5", recommended: "yes", q: "glow", sort: "lowest", page: "2" },
    domain,
  );

  it("keeps search, sort and paging out of the aggregate filters", () => {
    expect(toReviewFilterParams(s)).toEqual({
      date_from: undefined,
      date_to: undefined,
      subcategory: undefined,
      brand: ["Alpha Labs"],
      product_id: undefined,
      rating: [5],
      recommended: true,
    });
  });

  it("maps the table state to whitelisted sort fields", () => {
    const p = toReviewTableParams(s);
    expect(p).toMatchObject({ q: "glow", sort_by: "rating", order: "asc", page: 2, page_size: 20 });
  });

  it("round-trips through the URL", () => {
    const qs = toReviewPageSearchParams(s);
    expect(parseReviewState(Object.fromEntries(qs), domain)).toEqual(s);
  });

  it("omits defaults so URLs stay short", () => {
    expect(toReviewPageSearchParams(DEFAULT_REVIEW_STATE).toString()).toBe("");
  });

  it("builds drill-down links that reset paging", () => {
    expect(reviewHref(s, { product: "P1001" })).toBe(
      "/reviews?brand=Alpha+Labs&product=P1001&rating=5&recommended=yes&q=glow&sort=lowest",
    );
    expect(reviewHref(DEFAULT_REVIEW_STATE, {})).toBe("/reviews");
  });
});

describe("chips", () => {
  const s = withReviewChanges(DEFAULT_REVIEW_STATE, {
    from: "2020-01-01",
    product: "P1001",
    q: "serum",
    page: 4,
  });

  it("labels the product chip with its name when known", () => {
    expect(reviewChips(s, "Hydra Serum").map((c) => c.label)).toEqual([
      "From 2020-01-01",
      "Hydra Serum",
      "“serum”",
    ]);
    expect(reviewChips(s).find((c) => c.key === "product")?.label).toBe("P1001");
  });

  it("clears one chip and returns to page 1", () => {
    const next = clearReviewChip(s, "dates");
    expect(next.from).toBeUndefined();
    expect(next.page).toBe(1);
    expect(next.product).toBe("P1001");
  });

  it("treats the search alone as a table filter, not an aggregate filter", () => {
    expect(hasReviewPageFilters({ ...DEFAULT_REVIEW_STATE, q: "serum" })).toBe(false);
    expect(hasReviewPageFilters(s)).toBe(true);
  });

  it("reset keeps the sort only", () => {
    expect(clearAllReviewFilters({ ...s, sort: "oldest" })).toEqual({ sort: "oldest", page: 1 });
  });
});
