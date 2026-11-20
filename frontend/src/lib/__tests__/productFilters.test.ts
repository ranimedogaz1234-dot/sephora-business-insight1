import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORDER,
  DEFAULT_SORT,
  clearAllProductFilters,
  clearProductChip,
  normaliseSearch,
  parseProductFilters,
  productChips,
  toProductApiParams,
  toProductSearchParams,
  toggleSort,
  withChanges,
  type ProductDomain,
  type ProductFilters,
} from "@/lib/productFilters";

// Synthetic domain — not real dataset values.
const domain: ProductDomain = {
  categories: ["Skincare", "Makeup"],
  subcategories: { Skincare: ["Cleansers", "Moisturizers"], Makeup: ["Lip"] },
  brands: ["Alpha", "Beta & Co"],
  priceMax: 500,
};

const base: ProductFilters = { sort: DEFAULT_SORT, order: DEFAULT_ORDER, page: 1 };

describe("parseProductFilters", () => {
  it("defaults to popularity order on page 1", () => {
    expect(parseProductFilters({}, domain)).toEqual({ ...base, q: undefined, category: undefined, subcategory: undefined, brand: undefined, priceMin: undefined, priceMax: undefined, minRating: undefined });
  });

  it("keeps valid values and drops anything outside the domain", () => {
    const f = parseProductFilters(
      {
        q: "  serum ",
        category: "Skincare",
        subcategory: "Lip", // belongs to Makeup, not Skincare
        brand: "Nope",
        min_rating: "4.5",
        sort: "price_usd",
        order: "asc",
        page: "3",
      },
      domain,
    );
    expect(f).toMatchObject({ q: "serum", category: "Skincare", subcategory: undefined, brand: undefined, minRating: 4.5, sort: "price_usd", order: "asc", page: 3 });
  });

  it("rejects unknown sort fields, ratings, pages and malformed prices", () => {
    const f = parseProductFilters(
      { sort: "drop table", min_rating: "2", page: "-1", price_min: "abc", price_max: "1e9", category: "Hair" },
      domain,
    );
    expect(f.sort).toBe(DEFAULT_SORT);
    expect(f.minRating).toBeUndefined();
    expect(f.page).toBe(1);
    expect(f.priceMin).toBeUndefined();
    expect(f.priceMax).toBeUndefined();
    expect(f.category).toBeUndefined();
  });

  it("swaps an inverted price range", () => {
    const f = parseProductFilters({ price_min: "80", price_max: "20" }, domain);
    expect([f.priceMin, f.priceMax]).toEqual([20, 80]);
  });

  it("uses each field's natural direction when the order is omitted", () => {
    expect(parseProductFilters({ sort: "product_name" }, domain).order).toBe("asc");
    expect(parseProductFilters({ sort: "price_usd" }, domain).order).toBe("desc");
  });

  it("ignores single-character searches (the API minimum is 2)", () => {
    expect(normaliseSearch("a")).toBeUndefined();
    expect(normaliseSearch(" ab ")).toBe("ab");
    expect(normaliseSearch("x".repeat(150))).toHaveLength(100);
  });
});

describe("URL and API mapping", () => {
  const f: ProductFilters = {
    ...base,
    q: "mask",
    category: "Skincare",
    subcategory: "Cleansers",
    brand: "Beta & Co",
    priceMin: 10,
    priceMax: 50,
    minRating: 4,
    page: 2,
  };

  it("round-trips through the URL", () => {
    const sp = Object.fromEntries(toProductSearchParams(f));
    expect(parseProductFilters(sp, domain)).toEqual(f);
  });

  it("omits defaults from the URL", () => {
    expect(toProductSearchParams(base).toString()).toBe("");
  });

  it("maps to the backend's parameter names", () => {
    expect(toProductApiParams(f, 25)).toEqual({
      q: "mask",
      primary_category: ["Skincare"],
      secondary_category: ["Cleansers"],
      brand: ["Beta & Co"],
      price_min: 10,
      price_max: 50,
      min_catalogue_rating: 4,
      sort_by: DEFAULT_SORT,
      order: DEFAULT_ORDER,
      page: 2,
      page_size: 25,
    });
  });
});

describe("state transitions", () => {
  it("returns to page 1 when filters change and clears the subcategory with a new category", () => {
    const f = { ...base, category: "Skincare", subcategory: "Cleansers", page: 4 };
    expect(withChanges(f, { category: "Makeup" })).toMatchObject({ category: "Makeup", subcategory: undefined, page: 1 });
    expect(withChanges(f, { page: 5 }).page).toBe(5);
  });

  it("toggles direction on the active column and starts new columns at their natural order", () => {
    const priceDesc = toggleSort(base, "price_usd");
    expect(priceDesc).toMatchObject({ sort: "price_usd", order: "desc" });
    expect(toggleSort(priceDesc, "price_usd").order).toBe("asc");
    expect(toggleSort(priceDesc, "brand_name")).toMatchObject({ sort: "brand_name", order: "asc" });
  });

  it("describes and clears active filters", () => {
    const f = { ...base, q: "oil", priceMin: 5, minRating: 3.5, category: "Skincare", subcategory: "Cleansers" };
    expect(productChips(f).map((c) => c.label)).toEqual(["“oil”", "Skincare", "Cleansers", "$5 and up", "Rated 3.5+"]);
    expect(clearProductChip(f, "category")).toMatchObject({ category: undefined, subcategory: undefined });
    expect(clearProductChip(f, "price")).toMatchObject({ priceMin: undefined, priceMax: undefined });
    expect(clearAllProductFilters({ ...f, sort: "price_usd", order: "asc" })).toEqual({ sort: "price_usd", order: "asc", page: 1 });
  });
});
