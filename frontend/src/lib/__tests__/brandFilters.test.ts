import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAND_STATE,
  brandHref,
  hasBrandReviewFilters,
  parseBrandState,
  toBrandListParams,
  toBrandSearchParams,
  toggleBrandSort,
  withBrandChanges,
  type BrandDomain,
} from "@/lib/brandFilters";

// Synthetic domain — not real dataset values.
const domain: BrandDomain = {
  brands: ["Alpha Labs", "Beta & Co", "Gamma Glow"],
  categories: ["Skincare", "Makeup", "Fragrance"],
  subcategories: ["Cleansers", "Moisturizers"],
};

describe("parseBrandState", () => {
  it("returns defaults for an empty URL", () => {
    expect(parseBrandState({}, domain)).toEqual({
      ...DEFAULT_BRAND_STATE,
      subcategory: undefined,
      category: undefined,
      brand: undefined,
      q: undefined,
    });
  });

  it("parses every supported parameter, including brand names with special characters", () => {
    const s = parseBrandState(
      {
        subcategory: "Cleansers",
        min_reviews: "500",
        category: "Makeup",
        brand: "Beta & Co",
        q: " glow ",
        sort: "product_count",
        order: "asc",
        page: "2",
      },
      domain,
    );
    expect(s).toEqual({
      subcategory: "Cleansers",
      minReviews: 500,
      category: "Makeup",
      brand: "Beta & Co",
      q: "glow",
      sort: "product_count",
      order: "asc",
      page: 2,
    });
  });

  it("drops values outside the domain", () => {
    const s = parseBrandState(
      {
        subcategory: "Lip",
        min_reviews: "7",
        category: "Unknown",
        brand: "alpha labs",
        sort: "brand_id",
        order: "up",
        page: "0",
      },
      domain,
    );
    expect(s).toMatchObject({ ...DEFAULT_BRAND_STATE, brand: undefined, category: undefined, subcategory: undefined });
  });

  it("uses the natural first direction for a sort given without an order", () => {
    expect(parseBrandState({ sort: "brand_name" }, domain).order).toBe("asc");
    expect(parseBrandState({ sort: "loves_count" }, domain).order).toBe("desc");
  });
});

describe("URL and API params", () => {
  it("round-trips through the URL and omits defaults", () => {
    const s = parseBrandState({ brand: "Beta & Co", min_reviews: "25", q: "glow", page: "3" }, domain);
    expect(parseBrandState(Object.fromEntries(toBrandSearchParams(s)), domain)).toEqual(s);
    expect(toBrandSearchParams(DEFAULT_BRAND_STATE).toString()).toBe("");
  });

  it("encodes brand names safely in drill-down links", () => {
    expect(brandHref(DEFAULT_BRAND_STATE, { brand: "Beta & Co" }, "brand-focus")).toBe(
      "/brands?brand=Beta+%26+Co#brand-focus",
    );
    expect(brandHref(DEFAULT_BRAND_STATE, {})).toBe("/brands");
  });

  it("keeps the directory page when focusing a brand, but resets it on search or sort", () => {
    const s = { ...DEFAULT_BRAND_STATE, page: 4 };
    expect(withBrandChanges(s, { brand: "Gamma Glow" }).page).toBe(4);
    expect(withBrandChanges(s, { q: "alpha" }).page).toBe(1);
    expect(toggleBrandSort(s, "brand_name")).toMatchObject({ sort: "brand_name", order: "asc", page: 1 });
  });

  it("toggles direction on the active column", () => {
    const s = toggleBrandSort(DEFAULT_BRAND_STATE, "review_record_count");
    expect(s.order).toBe("asc");
  });

  it("maps the directory state to the brand list API", () => {
    const s = parseBrandState({ q: "glow", sort: "average_price", page: "2" }, domain);
    expect(toBrandListParams(s)).toEqual({ q: "glow", sort_by: "average_price", order: "desc", page: 2, page_size: 15 });
  });

  it("flags review-scope filters", () => {
    expect(hasBrandReviewFilters(DEFAULT_BRAND_STATE)).toBe(false);
    expect(hasBrandReviewFilters({ ...DEFAULT_BRAND_STATE, subcategory: "Cleansers" })).toBe(true);
  });
});
