import { describe, expect, it } from "vitest";
import type { CatalogueCategory, ProductDetail, ReviewCategory } from "@/lib/api/types";
import { productInsights } from "@/lib/insights";
import { parseReviewListState, toReviewApiParams, toReviewSearchParams } from "@/lib/reviewListState";

// Synthetic product — not real dataset values.
function product(overrides: Partial<ProductDetail["review_stats"]> = {}, price = 40): ProductDetail {
  return {
    product_id: "P1",
    product_name: "Test Serum",
    brand_name: "Alpha",
    primary_category: "Skincare",
    secondary_category: "Treatments",
    tertiary_category: null,
    price_usd: price,
    sale_price_usd: null,
    loves_count: 10,
    catalogue_rating: 4.1,
    sephora_review_count: 120,
    review_record_count: 100,
    review_average_rating: 4.5,
    new: false,
    limited_edition: false,
    sephora_exclusive: false,
    online_only: false,
    out_of_stock: false,
    brand_id: 1,
    size: null,
    variation_type: null,
    variation_value: null,
    value_price_usd: null,
    child_count: 0,
    highlights: [],
    ingredients: [],
    review_stats: {
      review_record_count: 100,
      average_rating: 4.5,
      five_star_share: 0.7,
      recommendation_rate: 0.9,
      rating_distribution: [
        { rating: 1, count: 5, share: 0.05 },
        { rating: 2, count: 5, share: 0.05 },
        { rating: 3, count: 5, share: 0.05 },
        { rating: 4, count: 15, share: 0.15 },
        { rating: 5, count: 70, share: 0.7 },
      ],
      first_review_date: "2020-01-01",
      last_review_date: "2022-12-31",
      ...overrides,
    },
  };
}

const peers: ReviewCategory = {
  subcategory: "Treatments",
  review_count: 1000,
  share: 0.1,
  average_rating: 4.2,
  five_star_share: 0.6,
  recommendation_rate: 0.8,
  reviewed_products: 20,
};

const priceGroup: CatalogueCategory = {
  category: "Treatments",
  product_count: 50,
  share_of_products: 0.2,
  brand_count: 10,
  average_price_usd: 60,
  median_price_usd: 50,
  average_catalogue_rating: 4.2,
  sephora_review_count: 5000,
  loves_count: 1000,
};

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("productInsights", () => {
  it("compares rating and recommendation with the subcategory", () => {
    const out = productInsights({ product: product(), subcategory: peers, priceGroup, yearly: [] });
    const rating = out.find((i) => i.id === "rating")!;
    expect(rating).toMatchObject({ tone: "positive", title: "Rated above its subcategory" });
    expect(rating.detail).toBe("Average 4.50 is 0.30 above the Treatments average of 4.20.");
    expect(out.find((i) => i.id === "recommend")!.tone).toBe("positive");
  });

  it("reports small differences as in line, and below-average ratings for attention", () => {
    const inLine = productInsights({ product: product({ average_rating: 4.25 }), subcategory: peers, priceGroup: null, yearly: [] });
    expect(inLine.find((i) => i.id === "rating")!.tone).toBe("neutral");
    const below = productInsights({ product: product({ average_rating: 3.9 }), subcategory: peers, priceGroup: null, yearly: [] });
    expect(below.find((i) => i.id === "rating")!.tone).toBe("attention");
  });

  it("flags a high share of 1–2 star ratings", () => {
    const p = product();
    p.review_stats.rating_distribution[0].count = 20; // 25 of 100 are 1–2 stars
    expect(ids(productInsights({ product: p, subcategory: null, priceGroup: null, yearly: [] }))).toContain("low");
    expect(ids(productInsights({ product: product(), subcategory: null, priceGroup: null, yearly: [] }))).not.toContain("low");
  });

  it("does not compare small samples", () => {
    const out = productInsights({ product: product({ review_record_count: 5 }), subcategory: peers, priceGroup: null, yearly: [] });
    expect(ids(out)).toEqual(["sample"]);
  });

  it("positions price against the category median", () => {
    const at = (price: number) =>
      productInsights({ product: product({}, price), subcategory: null, priceGroup, yearly: [] }).find((i) => i.id === "price")!.title;
    expect(at(80)).toBe("Priced above its category");
    expect(at(30)).toBe("Priced below its category");
    expect(at(50)).toBe("Priced near its category median");
    const detail = productInsights({ product: product({}, 50), subcategory: null, priceGroup, yearly: [] }).find((i) => i.id === "price")!.detail;
    expect(detail).toBe("$50 vs the $50 median of 50 products in Treatments.");
  });

  it("names the most active year from the yearly counts", () => {
    const out = productInsights({
      product: product(),
      subcategory: null,
      priceGroup: null,
      yearly: [
        { period: "2021", reviewCount: 30 },
        { period: "2022", reviewCount: 70 },
      ],
    });
    expect(out.find((i) => i.id === "peak")).toMatchObject({ title: "Most active year: 2022", detail: "70 review records (70.0% of its total)." });
  });

  it("returns nothing for a product without review records or peers", () => {
    expect(productInsights({ product: product({ review_record_count: 0 }), subcategory: null, priceGroup: null, yearly: [] })).toEqual([]);
  });
});

describe("review list state", () => {
  it("parses, defaults and round-trips", () => {
    expect(parseReviewListState({})).toEqual({ sort: "recent", rating: undefined, page: 1 });
    const s = parseReviewListState({ rsort: "helpful", rrating: "2", rpage: "4" });
    expect(s).toEqual({ sort: "helpful", rating: 2, page: 4 });
    expect(parseReviewListState(Object.fromEntries(toReviewSearchParams(s)))).toEqual(s);
    expect(parseReviewListState({ rsort: "evil", rrating: "9", rpage: "0" })).toEqual({ sort: "recent", rating: undefined, page: 1 });
  });

  it("sorts 'most helpful' by positive feedback count, not the helpfulness ratio", () => {
    expect(toReviewApiParams("P1", { sort: "helpful", page: 1 })).toMatchObject({
      product_id: ["P1"],
      sort_by: "total_pos_feedback_count",
      order: "desc",
    });
  });
});
