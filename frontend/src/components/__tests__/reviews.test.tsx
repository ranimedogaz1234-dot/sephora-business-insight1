import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Page, ReviewItem, ReviewerProfiles } from "@/lib/api/types";
import { DEFAULT_REVIEW_STATE, type ReviewDomain, type ReviewPageState } from "@/lib/reviewFilters";
import { ReviewFilterBar } from "@/components/reviews/ReviewFilterBar";
import { ReviewTable } from "@/components/reviews/ReviewTable";
import { ReviewerProfilesCard } from "@/components/reviews/ReviewerProfilesCard";
import { TopReviewedProducts } from "@/components/reviews/TopReviewedProducts";
import { SEARCH_DEBOUNCE_MS } from "@/components/ui/SearchField";

const setQuery = vi.fn();
vi.mock("@/components/layout/NavigationTransition", () => ({
  useNavigationTransition: () => ({ isPending: false, setQuery }),
}));

const lastQuery = () => setQuery.mock.calls.at(-1)![0].toString();

// Synthetic fixtures — not real dataset values.
const domain: ReviewDomain = {
  brands: ["Alpha Labs", "Beta Botanics"],
  subcategories: ["Cleansers", "Moisturizers"],
  dateMin: "2019-03-10",
  dateMax: "2023-03-01",
};
const brands = [
  { name: "Alpha Labs", count: 9 },
  { name: "Beta Botanics", count: 7 },
];
const subcategories = [
  { name: "Moisturizers", count: 8 },
  { name: "Cleansers", count: 3 },
];

const review = (id: string, overrides: Partial<ReviewItem> = {}): ReviewItem => ({
  review_id: id,
  product_id: "P1001",
  product_name: "Synthetic Serum",
  brand_name: "Alpha Labs",
  subcategory: "Treatments",
  rating: 4,
  is_recommended: true,
  helpfulness: 0.5,
  total_feedback_count: 4,
  total_pos_feedback_count: 2,
  total_neg_feedback_count: 2,
  submission_date: "2022-05-09",
  review_title: `Title ${id}`,
  review_text: "Synthetic review text.",
  skin_tone: null,
  skin_type: null,
  eye_color: null,
  hair_color: null,
  ...overrides,
});

const page = (items: ReviewItem[], total = items.length): Page<ReviewItem> => ({
  items,
  page: 1,
  page_size: 20,
  total,
  total_pages: Math.ceil(total / 20),
});

beforeEach(() => setQuery.mockClear());

describe("ReviewFilterBar", () => {
  const renderBar = (state: ReviewPageState = DEFAULT_REVIEW_STATE, productName?: string) =>
    render(
      <ReviewFilterBar
        state={state}
        domain={domain}
        brands={brands}
        subcategories={subcategories}
        productName={productName}
      />,
    );

  it("applies a select filter and returns to page 1", () => {
    renderBar({ ...DEFAULT_REVIEW_STATE, page: 5 });
    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "Beta Botanics" } });
    expect(lastQuery()).toBe("brand=Beta+Botanics");
  });

  it("filters by rating and recommendation", () => {
    renderBar();
    fireEvent.change(screen.getByLabelText("Star rating"), { target: { value: "2" } });
    expect(lastQuery()).toBe("rating=2");
    fireEvent.change(screen.getByLabelText("Recommendation"), { target: { value: "no" } });
    expect(lastQuery()).toBe("recommended=no");
  });

  it("applies the date range on blur, swapping an inverted range", () => {
    renderBar();
    fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2022-01-01" } });
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2020-01-01" } });
    expect(setQuery).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByLabelText("To date"));
    expect(lastQuery()).toBe("from=2020-01-01&to=2022-01-01");
  });

  it("shows removable chips, with the product's name", () => {
    renderBar({ ...DEFAULT_REVIEW_STATE, brand: "Alpha Labs", product: "P1001" }, "Synthetic Serum");
    const chips = screen.getByRole("list", { name: "Active filters" });
    fireEvent.click(within(chips).getByRole("button", { name: "Remove filter: Synthetic Serum" }));
    expect(lastQuery()).toBe("brand=Alpha+Labs");
    fireEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(lastQuery()).toBe("");
  });
});

describe("ReviewTable", () => {
  afterEach(() => vi.useRealTimers());

  it("renders reviews with product links and a product drill-down", () => {
    render(<ReviewTable reviews={page([review("r_1"), review("r_2", { is_recommended: null })])} state={DEFAULT_REVIEW_STATE} />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("link", { name: "Synthetic Serum" })[0]).toHaveAttribute("href", "/products/P1001");
    expect(within(table).getAllByRole("link", { name: "Show only reviews of Synthetic Serum" })[0]).toHaveAttribute(
      "href",
      "/reviews?product=P1001",
    );
    expect(within(table).getByText("Title r_1")).toBeInTheDocument();
    expect(within(table).getAllByRole("img", { name: "4 out of 5 stars" })).toHaveLength(2);
  });

  it("hides the product drill-down when that product is already selected", () => {
    render(<ReviewTable reviews={page([review("r_1")])} state={{ ...DEFAULT_REVIEW_STATE, product: "P1001" }} />);
    expect(screen.queryByRole("link", { name: /show only reviews/i })).not.toBeInTheDocument();
  });

  it("collapses long reviews behind 'Read full review'", () => {
    const long = "word ".repeat(120);
    render(<ReviewTable reviews={page([review("r_1", { review_text: long })])} state={DEFAULT_REVIEW_STATE} />);
    const table = screen.getByRole("table");
    const toggle = within(table).getByRole("button", { name: "Read full review" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("debounces the search and keeps the other filters", () => {
    vi.useFakeTimers();
    render(<ReviewTable reviews={page([review("r_1")])} state={{ ...DEFAULT_REVIEW_STATE, rating: 5, page: 3 }} />);
    fireEvent.change(screen.getByLabelText("Search review titles and text"), { target: { value: "glow" } });
    expect(setQuery).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
    expect(lastQuery()).toBe("rating=5&q=glow");
  });

  it("sorts from the menu", () => {
    render(<ReviewTable reviews={page([review("r_1")])} state={DEFAULT_REVIEW_STATE} />);
    fireEvent.change(screen.getByLabelText("Sort reviews"), { target: { value: "helpful" } });
    expect(lastQuery()).toBe("sort=helpful");
  });

  it("explains an empty search result", () => {
    render(<ReviewTable reviews={page([], 0)} state={{ ...DEFAULT_REVIEW_STATE, q: "nothing" }} />);
    expect(screen.getByText("No reviews mention “nothing” with the current filters.")).toBeInTheDocument();
  });

  it("paginates on the server", () => {
    render(<ReviewTable reviews={{ ...page([review("r_1")], 45), total_pages: 3 }} state={DEFAULT_REVIEW_STATE} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(lastQuery()).toBe("page=2");
  });
});

describe("ReviewerProfilesCard", () => {
  const data: ReviewerProfiles = {
    total_reviews: 10,
    dimensions: [
      {
        dimension: "skin_type",
        answered: 8,
        missing: 2,
        segments: [
          { value: "dry", review_count: 5, share: 0.625, average_rating: 4.2, five_star_share: 0.4, recommendation_rate: 0.8 },
          { value: "oily", review_count: 3, share: 0.375, average_rating: 3.0, five_star_share: 0.0, recommendation_rate: null },
        ],
      },
      { dimension: "skin_tone", answered: 0, missing: 10, segments: [] },
      { dimension: "eye_color", answered: 0, missing: 10, segments: [] },
      { dimension: "hair_color", answered: 0, missing: 10, segments: [] },
    ],
  };

  it("shows shares among answered reviews and states the unanswered count", () => {
    render(<ReviewerProfilesCard data={data} />);
    expect(screen.getByText(/80\.0% answered \(2 did not\)/)).toBeInTheDocument();
    expect(screen.getByText("Dry")).toBeInTheDocument();
    expect(screen.getByText("62.5%")).toBeInTheDocument();
  });

  it("switches attribute and shows an empty state when nobody answered", () => {
    render(<ReviewerProfilesCard data={data} />);
    fireEvent.click(screen.getByRole("button", { name: "Skin tone" }));
    expect(screen.getByRole("button", { name: "Skin tone" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("No reviews in this selection report a skin tone.")).toBeInTheDocument();
  });
});

describe("TopReviewedProducts", () => {
  it("links to product details and to the filtered review view", () => {
    render(
      <TopReviewedProducts
        state={{ ...DEFAULT_REVIEW_STATE, brand: "Alpha Labs" }}
        items={[
          {
            rank: 1,
            product_id: "P1001",
            product_name: "Synthetic Serum",
            brand_name: "Alpha Labs",
            subcategory: "Treatments",
            price_usd: 42,
            review_count: 12,
            average_rating: 4.25,
            five_star_share: 0.5,
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Synthetic Serum" })).toHaveAttribute("href", "/products/P1001");
    expect(screen.getByRole("link", { name: "Explore reviews of Synthetic Serum" })).toHaveAttribute(
      "href",
      "/reviews?brand=Alpha+Labs&product=P1001",
    );
  });
});
