import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrandItem, Page } from "@/lib/api/types";
import { DEFAULT_BRAND_STATE } from "@/lib/brandFilters";
import { BrandDirectory } from "@/components/brands/BrandDirectory";
import { BrandFilterBar } from "@/components/brands/BrandFilterBar";
import { BrandFocus } from "@/components/brands/BrandFocus";
import { RankedBarList } from "@/components/charts/RankedBarList";

const setQuery = vi.fn();
vi.mock("@/components/layout/NavigationTransition", () => ({
  useNavigationTransition: () => ({ isPending: false, setQuery }),
}));

const lastQuery = () => setQuery.mock.calls.at(-1)![0].toString();

// Synthetic rows — not real dataset values.
const brand = (name: string, overrides: Partial<BrandItem> = {}): BrandItem => ({
  brand_name: name,
  product_count: 12,
  category_count: 2,
  average_price_usd: 34.5,
  loves_count: 25_000,
  sephora_review_count: 900,
  review_record_count: 640,
  review_average_rating: 4.21,
  ...overrides,
});

const page = (items: BrandItem[]): Page<BrandItem> => ({
  items,
  page: 1,
  page_size: 15,
  total: items.length,
  total_pages: 1,
});

beforeEach(() => setQuery.mockClear());

describe("BrandFilterBar", () => {
  const subcategories = [{ name: "Cleansers", count: 10 }];

  it("focuses a brand and scopes reviews by subcategory", () => {
    render(<BrandFilterBar state={DEFAULT_BRAND_STATE} brands={["Alpha Labs", "Beta & Co"]} subcategories={subcategories} />);
    fireEvent.change(screen.getByLabelText("Focus brand"), { target: { value: "Beta & Co" } });
    expect(lastQuery()).toBe("brand=Beta+%26+Co");
    fireEvent.change(screen.getByLabelText("Skincare subcategory (reviews)"), { target: { value: "Cleansers" } });
    expect(lastQuery()).toBe("subcategory=Cleansers");
    fireEvent.change(screen.getByLabelText("Minimum reviews to rank"), { target: { value: "500" } });
    expect(lastQuery()).toBe("min_reviews=500");
  });

  it("resets the analysis filters but keeps the directory state", () => {
    render(
      <BrandFilterBar
        state={{ ...DEFAULT_BRAND_STATE, brand: "Alpha Labs", minReviews: 25, q: "al", page: 2 }}
        brands={["Alpha Labs"]}
        subcategories={subcategories}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(lastQuery()).toBe("q=al&page=2");
  });
});

describe("BrandDirectory", () => {
  it("keeps catalogue and review-record figures apart and links to the brand focus", () => {
    render(<BrandDirectory brands={page([brand("Alpha Labs"), brand("Delta", { review_record_count: 0, review_average_rating: null })])} state={DEFAULT_BRAND_STATE} />);
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("900")).toBeInTheDocument(); // Sephora-listed
    expect(within(rows[1]).getByText("640")).toBeInTheDocument(); // review records
    expect(within(rows[2]).getAllByText("—")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Focus Alpha Labs" })).toHaveAttribute(
      "href",
      "/brands?brand=Alpha+Labs#brand-focus",
    );
  });

  it("sorts from a column header with aria-sort", () => {
    render(<BrandDirectory brands={page([brand("Alpha Labs")])} state={DEFAULT_BRAND_STATE} />);
    expect(screen.getByRole("columnheader", { name: /review records/i })).toHaveAttribute("aria-sort", "descending");
    fireEvent.click(screen.getByRole("button", { name: /^products/i }));
    expect(lastQuery()).toBe("sort=product_count&order=desc");
  });

  it("explains an empty search", () => {
    render(<BrandDirectory brands={page([])} state={{ ...DEFAULT_BRAND_STATE, q: "zz" }} />);
    expect(screen.getByText("No brand name contains “zz”.")).toBeInTheDocument();
  });
});

describe("RankedBarList drill-down", () => {
  it("renders an accessible link only for rows with a target", () => {
    render(
      <RankedBarList
        ariaLabel="Brands"
        items={[
          { key: "a", label: "Alpha", value: 2, display: "2", href: "/brands?brand=Alpha", hrefLabel: "Focus Alpha" },
          { key: "b", label: "Beta", value: 1, display: "1" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Focus Alpha" })).toHaveAttribute("href", "/brands?brand=Alpha");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("BrandFocus", () => {
  const ok = <T,>(value: T) => ({ ok: true as const, value });
  const subcat = (subcategory: string, review_count: number, average_rating: number) => ({
    subcategory,
    review_count,
    share: 0.5,
    average_rating,
    five_star_share: 0.5,
    recommendation_rate: 0.8,
    reviewed_products: 3,
  });

  it("compares the brand with all brands and only flags differences with enough reviews", () => {
    render(
      <BrandFocus
        state={{ ...DEFAULT_BRAND_STATE, brand: "Alpha Labs" }}
        brand={brand("Alpha Labs")}
        kpis={{ ok: false, error: "unavailable" }}
        categoryMix={ok({
          level: "primary" as const,
          parent: null,
          brand: "Alpha Labs",
          total_products: 12,
          items: [
            {
              category: "Skincare",
              product_count: 12,
              share_of_products: 1,
              brand_count: 1,
              average_price_usd: 30,
              median_price_usd: 28,
              average_catalogue_rating: 4.2,
              sephora_review_count: 900,
              loves_count: 25_000,
            },
          ],
        })}
        brandSubcats={ok({
          scope_category: "Skincare",
          total_reviews: 70,
          items: [subcat("Cleansers", 60, 4.5), subcat("Masks", 10, 3.0)],
        })}
        allSubcats={ok({
          scope_category: "Skincare",
          total_reviews: 1000,
          items: [subcat("Cleansers", 600, 4.1), subcat("Masks", 400, 4.0)],
        })}
        topProducts={ok([])}
      />,
    );
    const table = screen.getByRole("table");
    const [, cleansers, masks] = within(table).getAllByRole("row");
    expect(within(cleansers).getByText(/above all brands/)).toBeInTheDocument();
    expect(within(masks).queryByText(/all brands/)).not.toBeInTheDocument(); // 10 reviews: not compared
    expect(screen.getByRole("link", { name: "Review analytics" })).toHaveAttribute("href", "/reviews?brand=Alpha+Labs");
    expect(screen.getByRole("link", { name: "Close brand focus" })).toHaveAttribute("href", "/brands");
    expect(screen.getByText(/no review records in the current selection/i)).toBeInTheDocument();
  });
});
