import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { KpiSection } from "@/components/dashboard/KpiSection";
import { FilterBar } from "@/components/filters/FilterBar";
import { RankedBarList } from "@/components/charts/RankedBarList";
import { RatingDistributionCard } from "@/components/charts/RatingDistributionCard";
import { ActivityHeatmapCard } from "@/components/charts/ActivityHeatmapCard";
import type { ExecutiveKpis } from "@/lib/api/types";
import type { FilterDomain } from "@/lib/filters";

const setQuery = vi.fn();
vi.mock("@/components/layout/NavigationTransition", () => ({
  useNavigationTransition: () => ({ isPending: false, setQuery }),
}));

// Synthetic figures only — no real dataset values.
const kpis: ExecutiveKpis = {
  catalogue: {
    total_products: 8,
    total_brands: 4,
    total_categories: 4,
    sephora_review_count: 355,
    average_price_usd: 84.625,
    median_price_usd: 38.5,
  },
  reviews: {
    review_count: 16,
    average_rating: 3.625,
    five_star_share: 0.375,
    recommendation_rate: 0.7143,
    recommendation_responses: 14,
    unique_reviewers: 14,
    reviewed_products: 4,
    reviewed_brands: 1,
    first_review_date: "2019-03-10",
    last_review_date: "2023-03-01",
  },
  data_quality: { raw_review_count: 18, duplicate_reviews_removed: 2, review_records_total: 16 },
  review_scope_category: "Skincare",
  filters_applied: false,
};

describe("KpiSection", () => {
  it("leads with the review-record total and keeps catalogue counts separate", () => {
    render(<KpiSection kpis={kpis} />);
    expect(screen.getByText("Total reviews").nextElementSibling).toHaveTextContent("16");
    expect(screen.getByText(/4 Skincare products · 1 brand$/)).toBeInTheDocument();
    expect(screen.getByText(/18 raw rows; 2 exact duplicate copies removed/)).toBeInTheDocument();
    const listed = screen.getByText("Sephora-listed reviews").parentElement!;
    expect(listed).toHaveAttribute("title", expect.stringMatching(/not the review records/i));
    expect(within(listed).getByText("355")).toBeInTheDocument();
    expect(screen.getByText("Not affected by review filters")).toBeInTheDocument();
  });

  it("shows an honest empty state when filters match nothing", () => {
    render(
      <KpiSection
        kpis={{
          ...kpis,
          filters_applied: true,
          reviews: { ...kpis.reviews, review_count: 0, average_rating: null, five_star_share: null },
        }}
      />,
    );
    expect(screen.getByText("Reviews in selection")).toBeInTheDocument();
    expect(screen.getByText("No reviews match the current filters.")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });
});

const domain: FilterDomain = {
  years: [2021, 2022, 2023],
  dateMax: "2023-03-21",
  brands: ["Alpha Labs"],
  subcategories: ["Cleansers"],
};

describe("FilterBar", () => {
  const props = {
    domain,
    brands: [{ name: "Alpha Labs", count: 9 }],
    subcategories: [{ name: "Cleansers", count: 4 }],
  };

  it("writes the selected filters to the URL", () => {
    setQuery.mockClear();
    render(<FilterBar {...props} filters={{ period: "all", rankYear: 2022 }} />);
    fireEvent.change(screen.getByLabelText("Period"), { target: { value: "year:2021" } });
    expect(setQuery.mock.calls[0][0].toString()).toBe("period=year&year=2021");
    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "Alpha Labs" } });
    expect(setQuery.mock.calls[1][0].toString()).toBe("brand=Alpha+Labs");
  });

  it("labels the partial final year and offers a custom range", () => {
    render(<FilterBar {...props} filters={{ period: "all", rankYear: 2022 }} />);
    expect(screen.getByRole("option", { name: "2023 (partial)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Custom year range…" })).toBeInTheDocument();
  });

  it("shows removable chips and a reset for active filters", () => {
    setQuery.mockClear();
    render(<FilterBar {...props} filters={{ period: "year", year: 2021, brand: "Alpha Labs", rankYear: 2022 }} />);
    const chips = screen.getByRole("list", { name: "Active filters" });
    fireEvent.click(within(chips).getByRole("button", { name: "Remove filter: Alpha Labs" }));
    expect(setQuery.mock.calls[0][0].toString()).toBe("period=year&year=2021");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(setQuery.mock.calls[1][0].toString()).toBe("");
  });
});

describe("RankedBarList", () => {
  it("prints every value and scales bars to the maximum", () => {
    const { container } = render(
      <RankedBarList
        ariaLabel="Synthetic ranking"
        items={[
          { key: "a", label: "Product A", sublabel: "Brand X", value: 50, display: "50" },
          { key: "b", label: "Product B", value: 25, display: "25", secondary: "★ 4.10" },
        ]}
      />,
    );
    const list = screen.getByRole("list", { name: "Synthetic ranking" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("★ 4.10")).toBeInTheDocument();
    const fills = container.querySelectorAll<HTMLElement>(".bg-burgundy");
    expect([...fills].map((f) => f.style.width)).toEqual(["100%", "50%"]);
  });

  it("supports a fixed scale such as a 5-point rating", () => {
    const { container } = render(
      <RankedBarList ariaLabel="Ratings" max={5} items={[{ key: "c", label: "Cleansers", value: 4, display: "4.00" }]} />,
    );
    expect(container.querySelector<HTMLElement>(".bg-burgundy")!.style.width).toBe("80%");
  });
});

describe("Chart table views", () => {
  it("switches the rating distribution to an accessible table", () => {
    render(
      <RatingDistributionCard
        data={{
          total: 10,
          average_rating: 4,
          buckets: [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: r === 5 ? 6 : 1, share: r === 5 ? 0.6 : 0.1 })),
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Table view" }));
    const table = screen.getByRole("table", { name: "Rating distribution" });
    expect(within(table).getAllByRole("row")).toHaveLength(6);
    expect(within(table).getByText("60.0%")).toBeInTheDocument();
  });

  it("renders the heatmap as labelled, focusable cells with a scale legend", () => {
    render(
      <ActivityHeatmapCard
        data={{
          years: [2022],
          months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          max_count: 40,
          cells: Array.from({ length: 12 }, (_, i) => ({ year: 2022, month: i + 1, review_count: i * 4 })),
        }}
      />,
    );
    expect(screen.getAllByRole("img", { name: /2022: \d+ reviews$/ })).toHaveLength(12);
    expect(screen.getByRole("img", { name: "Dec 2022: 44 reviews" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByLabelText("Color scale")).toBeInTheDocument();
  });

  it("shows an empty state instead of an empty chart", () => {
    render(<RatingDistributionCard data={{ total: 0, average_rating: null, buckets: [] }} />);
    expect(screen.getByText("No reviews match the current filters.")).toBeInTheDocument();
  });
});
