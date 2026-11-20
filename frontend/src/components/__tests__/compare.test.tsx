import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComparedProduct, Page, ProductItem } from "@/lib/api/types";
import { CompareCards, leaderIndex } from "@/components/compare/CompareCards";
import { ComparePicker } from "@/components/compare/ComparePicker";
import { CompareLegend, RatingMixCompare } from "@/components/compare/CompareCharts";

const setQuery = vi.fn();
vi.mock("@/components/layout/NavigationTransition", () => ({
  useNavigationTransition: () => ({ isPending: false, setQuery }),
}));

beforeEach(() => setQuery.mockClear());

// Synthetic rows — not real dataset values.
const item = (id: string, overrides: Partial<ProductItem> = {}): ProductItem => ({
  product_id: id,
  product_name: `Product ${id}`,
  brand_name: "Alpha",
  primary_category: "Skincare",
  secondary_category: "Cleansers",
  tertiary_category: null,
  price_usd: 25,
  sale_price_usd: null,
  loves_count: 1200,
  catalogue_rating: 4.25,
  sephora_review_count: 80,
  review_record_count: 64,
  review_average_rating: 4.3,
  new: false,
  limited_edition: false,
  sephora_exclusive: false,
  online_only: false,
  out_of_stock: false,
  ...overrides,
});

const compared = (id: string, overrides: Partial<ComparedProduct> = {}, avg: number | null = 4.3, n = 10): ComparedProduct => ({
  ...item(id),
  size: "50 ml",
  review_stats: {
    review_record_count: n,
    average_rating: avg,
    five_star_share: n ? 0.5 : null,
    recommendation_rate: n ? 0.8 : null,
    rating_distribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: rating === 5 ? n : 0, share: rating === 5 && n ? 1 : 0 })),
    first_review_date: n ? "2020-01-01" : null,
    last_review_date: n ? "2023-01-01" : null,
  },
  ...overrides,
});

const page = (items: ProductItem[], total = items.length): Page<ProductItem> => ({
  items,
  page: 1,
  page_size: 8,
  total,
  total_pages: 1,
});

describe("leaderIndex", () => {
  it("marks a single leader only", () => {
    expect(leaderIndex([3, 5, 4], "high")).toBe(1);
    expect(leaderIndex([30, 20, 25], "low")).toBe(1);
    expect(leaderIndex([5, 5, 4], "high")).toBe(-1); // tie
    expect(leaderIndex([5, null], "high")).toBe(-1); // only one value
  });
});

describe("CompareCards", () => {
  it("shows one card per product and marks clear leaders", () => {
    render(
      <CompareCards
        items={[compared("P1", { price_usd: 20, loves_count: 900 }, 4.6), compared("P2", { price_usd: 40, loves_count: 5000 }, 4.1)]}
      />,
    );
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole("link", { name: "Product P1" })).toHaveAttribute("href", "/products/P1");
    expect(within(cards[0]).getByText("Lowest")).toBeInTheDocument(); // price
    expect(within(cards[0]).getAllByText("Highest")).toHaveLength(1); // average rating
    expect(within(cards[1]).getAllByText("Highest")).toHaveLength(1); // loves
  });

  it("explains a product outside the review dataset", () => {
    render(
      <CompareCards
        items={[compared("P1"), compared("P9", { primary_category: "Fragrance", secondary_category: "Women" }, null, 0)]}
      />,
    );
    expect(screen.getByText(/Outside Skincare/)).toBeInTheDocument();
  });
});

describe("ComparePicker", () => {
  const selected = [
    { product_id: "P1", product_name: "Product P1", brand_name: "Alpha" },
    { product_id: "P2", product_name: "Product P2", brand_name: "Alpha" },
  ];

  it("removes a product and keeps the others in order", () => {
    render(<ComparePicker state={{ ids: ["P1", "P2"], grain: "year" }} selected={selected} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Product P1 from the comparison" }));
    expect(setQuery.mock.calls.at(-1)![0].toString()).toBe("ids=P2");
  });

  it("offers Add links for search results and marks products already added", () => {
    render(
      <ComparePicker
        state={{ ids: ["P1", "P2"], find: "pro", grain: "year" }}
        selected={selected}
        results={page([item("P2"), item("P3", { review_record_count: 0 })], 30)}
      />,
    );
    const results = screen.getByRole("list", { name: "Search results" });
    expect(within(results).getByText("Added")).toBeInTheDocument();
    expect(within(results).getByRole("link", { name: "Add Product P3 to the comparison" })).toHaveAttribute(
      "href",
      "/compare?ids=P1%2CP2%2CP3&find=pro",
    );
    expect(within(results).getByText(/no review records/)).toBeInTheDocument();
    expect(screen.getByText(/Showing the 2 most reviewed of 30 matches/)).toBeInTheDocument();
  });

  it("disables adding once four products are compared", () => {
    render(
      <ComparePicker
        state={{ ids: ["P1", "P2", "P3", "P4"], find: "pro", grain: "year" }}
        selected={selected}
        results={page([item("P5")])}
      />,
    );
    expect(screen.getByRole("link", { name: "Add Product P5 to the comparison" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(/remove one to add another/)).toBeInTheDocument();
  });

  it("explains an empty search", () => {
    render(<ComparePicker state={{ ids: [], find: "zz", grain: "year" }} selected={[]} results={page([])} />);
    expect(screen.getByText("No products match “zz”.")).toBeInTheDocument();
  });
});

describe("comparison charts", () => {
  it("labels every series in the legend and flags products without review records", () => {
    render(<CompareLegend items={[compared("P1"), compared("P2", {}, null, 0)]} />);
    const items = within(screen.getByRole("list", { name: "Legend" })).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveTextContent("(no review records)");
    expect(items[0]).not.toHaveTextContent("no review records");
  });

  it("shows an empty state when no product has review records", () => {
    render(<RatingMixCompare items={[compared("P1", {}, null, 0), compared("P2", {}, null, 0)]} />);
    expect(screen.getByText(/None of these products has review records/)).toBeInTheDocument();
  });
});
