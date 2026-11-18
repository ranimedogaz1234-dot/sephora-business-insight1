import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Page, ProductItem, ReviewItem } from "@/lib/api/types";
import { DEFAULT_ORDER, DEFAULT_SORT, type ProductFilters } from "@/lib/productFilters";
import { ProductFilterBar, SEARCH_DEBOUNCE_MS } from "@/components/products/ProductFilterBar";
import { ProductTable } from "@/components/products/ProductTable";
import { ProductReviewList } from "@/components/products/ProductReviewList";
import { Pagination, pageWindow } from "@/components/ui/Pagination";

const setQuery = vi.fn();
vi.mock("@/components/layout/NavigationTransition", () => ({
  useNavigationTransition: () => ({ isPending: false, setQuery }),
}));

const lastQuery = () => setQuery.mock.calls.at(-1)![0].toString();
const base: ProductFilters = { sort: DEFAULT_SORT, order: DEFAULT_ORDER, page: 1 };

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

beforeEach(() => setQuery.mockClear());

describe("ProductTable", () => {
  it("links each product to its detail page and keeps the two review counts apart", () => {
    render(<ProductTable items={[item("P1", { new: true }), item("P2", { review_record_count: 0, catalogue_rating: null })]} filters={base} />);
    expect(screen.getByRole("link", { name: "Product P1" })).toHaveAttribute("href", "/products/P1");
    expect(screen.getByText("New")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("80")).toBeInTheDocument(); // Sephora-listed reviews
    expect(within(rows[1]).getByText("64")).toBeInTheDocument(); // review records
    expect(within(rows[2]).getAllByText("—")).toHaveLength(2); // no rating, no review records
  });

  it("marks the sorted column and sorts by a header click", () => {
    render(<ProductTable items={[item("P1")]} filters={base} />);
    expect(screen.getByRole("columnheader", { name: /loves/i })).toHaveAttribute("aria-sort", "descending");
    fireEvent.click(screen.getByRole("button", { name: /^price/i }));
    expect(lastQuery()).toBe("sort=price_usd&order=desc");
  });
});

describe("ProductFilterBar", () => {
  const props = {
    categories: [
      { name: "Skincare", count: 3 },
      { name: "Makeup", count: 2 },
    ],
    subcategories: { Skincare: [{ name: "Cleansers", count: 2 }], Makeup: [{ name: "Lip", count: 2 }] },
    brands: ["Alpha", "Beta"],
  };

  afterEach(() => vi.useRealTimers());

  it("debounces search and ignores single characters", () => {
    vi.useFakeTimers();
    render(<ProductFilterBar filters={base} {...props} />);
    const box = screen.getByRole("searchbox", { name: /search products/i });
    fireEvent.change(box, { target: { value: "s" } });
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(setQuery).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 2 characters/)).toBeInTheDocument();
    fireEvent.change(box, { target: { value: "se" } });
    fireEvent.change(box, { target: { value: "ser" } });
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(setQuery).toHaveBeenCalledTimes(1);
    expect(lastQuery()).toBe("q=ser");
  });

  it("enables subcategories only after a category is chosen", () => {
    const { rerender } = render(<ProductFilterBar filters={base} {...props} />);
    expect(screen.getByLabelText("Subcategory")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "Skincare" } });
    expect(lastQuery()).toBe("category=Skincare");
    rerender(<ProductFilterBar filters={{ ...base, category: "Skincare" }} {...props} />);
    expect(screen.getByLabelText("Subcategory")).toBeEnabled();
    expect(within(screen.getByLabelText("Subcategory")).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "All subcategories",
      "Cleansers (2)",
    ]);
  });

  it("applies the price range on blur and the minimum rating and sort presets", () => {
    render(<ProductFilterBar filters={{ ...base, page: 3 }} {...props} />);
    fireEvent.change(screen.getByLabelText("Minimum price"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("Maximum price"), { target: { value: "20" } });
    fireEvent.blur(screen.getByLabelText("Maximum price"));
    expect(lastQuery()).toBe("price_min=20&price_max=60"); // swapped, back to page 1
    fireEvent.change(screen.getByLabelText("Minimum rating"), { target: { value: "4" } });
    expect(lastQuery()).toBe("min_rating=4");
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "price_usd:asc" } });
    expect(lastQuery()).toBe("sort=price_usd&order=asc");
  });

  it("removes one filter from its chip and all filters with Reset", () => {
    render(<ProductFilterBar filters={{ ...base, brand: "Alpha", minRating: 4 }} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Alpha" }));
    expect(lastQuery()).toBe("min_rating=4");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(lastQuery()).toBe("");
  });
});

describe("Pagination", () => {
  it("builds a compact window", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]);
  });

  it("changes only its own parameter and drops it for page 1", () => {
    render(<Pagination page={2} totalPages={5} total={120} pageSize={25} query="q=oil&page=2" />);
    expect(screen.getByText("26–50 of 120 results")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(lastQuery()).toBe("q=oil&page=3");
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(lastQuery()).toBe("q=oil");
  });

  it("renders nothing without results", () => {
    const { container } = render(<Pagination page={1} totalPages={0} total={0} pageSize={25} query="" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ProductReviewList", () => {
  const review = (id: string, overrides: Partial<ReviewItem> = {}): ReviewItem => ({
    review_id: id,
    product_id: "P1",
    product_name: "Product P1",
    brand_name: "Alpha",
    subcategory: "Cleansers",
    rating: 4,
    is_recommended: true,
    helpfulness: 0.75,
    total_feedback_count: 4,
    total_pos_feedback_count: 3,
    total_neg_feedback_count: 1,
    submission_date: "2022-05-01",
    review_title: "Synthetic title",
    review_text: "Synthetic text.",
    skin_tone: null,
    skin_type: "dry",
    eye_color: null,
    hair_color: null,
    ...overrides,
  });
  const page = (items: ReviewItem[], total = items.length): Page<ReviewItem> => ({
    items,
    page: 1,
    page_size: 10,
    total,
    total_pages: Math.ceil(total / 10),
  });

  it("shows review content, stars and helpful votes", () => {
    render(<ProductReviewList reviews={page([review("r1")])} state={{ sort: "recent", page: 1 }} />);
    expect(screen.getByRole("img", { name: "4 out of 5 stars" })).toBeInTheDocument();
    expect(screen.getByText("Synthetic title")).toBeInTheDocument();
    expect(screen.getByText("Recommends")).toBeInTheDocument();
    expect(screen.getByText(/3 of 4 found this/)).toBeInTheDocument();
    expect(screen.getByText("dry skin")).toBeInTheDocument();
  });

  it("collapses long reviews and expands them on request", () => {
    const long = "word ".repeat(120).trim();
    render(<ProductReviewList reviews={page([review("r1", { review_text: long })])} state={{ sort: "recent", page: 1 }} />);
    const toggle = screen.getByRole("button", { name: "Read full review" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByText(long)).toBeInTheDocument();
  });

  it("filters by star rating via the URL and shows an empty state", () => {
    render(<ProductReviewList reviews={page([], 0)} state={{ sort: "helpful", rating: 1, page: 2 }} />);
    expect(screen.getByText("No 1-star reviews for this product.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Star rating"), { target: { value: "" } });
    expect(lastQuery()).toBe("rsort=helpful");
  });
});
