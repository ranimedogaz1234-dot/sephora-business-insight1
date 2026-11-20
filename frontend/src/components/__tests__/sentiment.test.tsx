import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComparedProduct, SentimentBreakdown, SentimentGroup, SentimentInsights, SentimentSummary } from "@/lib/api/types";
import {
  DEFAULT_SENTIMENT_STATE,
  parseSentimentState,
  toSentimentFilters,
  toSentimentSearchParams,
} from "@/lib/sentimentState";
import { CompareSentiment } from "@/components/compare/CompareSentiment";
import { SentimentBar } from "@/components/sentiment/SentimentBar";
import { SentimentBreakdownCard } from "@/components/sentiment/SentimentBreakdownCard";
import { SentimentDonutCard } from "@/components/sentiment/SentimentCharts";
import { CoverageStrip, InsightsCard, NotActivated, SyntheticBanner } from "@/components/sentiment/SentimentPanels";

const setQuery = vi.fn();
vi.mock("@/components/layout/NavigationTransition", () => ({
  useNavigationTransition: () => ({ isPending: false, setQuery }),
}));
const lastQuery = () => setQuery.mock.calls.at(-1)![0].toString();
beforeEach(() => setQuery.mockClear());

// Synthetic values — not real dataset results.
const domain = { brands: ["Alpha Labs"], subcategories: ["Cleansers"], years: [2021, 2022] };

const summary = (overrides: Partial<SentimentSummary> = {}): SentimentSummary => ({
  status: "partial",
  total_reviews: 200,
  classified: 100,
  coverage: 0.5,
  dataset_classified: 100,
  dataset_reviews: 1000,
  synthetic: false,
  sources: [{ name: "claude", count: 100 }],
  models: ["claude-opus-5-5"],
  prompt_versions: ["2026-11-v1"],
  distribution: [
    { label: "positive", count: 70, share: 0.7 },
    { label: "neutral", count: 10, share: 0.1 },
    { label: "negative", count: 20, share: 0.2 },
  ],
  last_run: null,
  ...overrides,
});

const group = (key: string, overrides: Partial<SentimentGroup> = {}): SentimentGroup => ({
  key,
  name: key,
  brand_name: null,
  classified: 60,
  positive: 42,
  neutral: 6,
  negative: 12,
  positive_share: 0.7,
  neutral_share: 0.1,
  negative_share: 0.2,
  net: 0.5,
  ...overrides,
});

describe("sentiment state", () => {
  it("validates against the review domain and round-trips", () => {
    const s = parseSentimentState({ brand: "Alpha Labs", year: "2022", by: "product", sort: "net", min: "100", grain: "month" }, domain);
    expect(s).toEqual({ brand: "Alpha Labs", subcategory: undefined, year: 2022, by: "product", sort: "net", min: 100, grain: "month" });
    expect(parseSentimentState(Object.fromEntries(toSentimentSearchParams(s)), domain)).toEqual(s);
    expect(parseSentimentState({ brand: "x", year: "1999", by: "author", sort: "evil", min: "3" }, domain)).toEqual({
      ...DEFAULT_SENTIMENT_STATE,
      brand: undefined,
      subcategory: undefined,
      year: undefined,
    });
  });

  it("maps a year to an inclusive date range", () => {
    expect(toSentimentFilters({ ...DEFAULT_SENTIMENT_STATE, year: 2021 })).toMatchObject({
      date_from: "2021-01-01",
      date_to: "2021-12-31",
    });
  });
});

describe("panels", () => {
  it("shows no figures before any classification, only how to start", () => {
    render(<NotActivated datasetReviews={1000} />);
    expect(screen.getByText(/has not been run yet/)).toBeInTheDocument();
    expect(screen.getByText(/No sentiment is estimated or invented/)).toBeInTheDocument();
    expect(screen.getByText(/--max-cost 3 --yes/)).toBeInTheDocument();
  });

  it("labels synthetic data as not AI results", () => {
    render(<SyntheticBanner />);
    expect(screen.getByRole("note")).toHaveTextContent("They are not AI results");
  });

  it("states coverage and that partial coverage is a sample", () => {
    render(<CoverageStrip data={summary()} />);
    expect(screen.getByText("50.0%")).toBeInTheDocument();
    expect(screen.getByText(/reflect a sample of this selection/)).toBeInTheDocument();
    expect(screen.getByText("Claude API")).toBeInTheDocument();
  });

  it("renders insights with their evidence and labels AI-written ones", () => {
    const data: SentimentInsights = {
      min_classified: 50,
      computed: [{ id: "overall", title: "Overall sentiment", statement: "70.0% read positive.", evidence: [{ label: "Classified reviews", value: "100" }] }],
      ai: { created_at: "2026-11-20T10:00:00+00:00", model: "claude-opus-5-5", items: [{ id: "ai_1", title: "Mostly positive", statement: "Most reviews are positive.", evidence: [{ label: "overall.positive_share", value: "0.7" }] }] },
    };
    render(<InsightsCard data={data} />);
    expect(screen.getByText("AI-written insights · claude-opus-5-5")).toBeInTheDocument();
    expect(screen.getByText("overall.positive_share:")).toBeInTheDocument();
    expect(screen.getByText("Classified reviews:")).toBeInTheDocument();
  });
});

describe("charts", () => {
  it("describes the stacked bar in text", () => {
    render(<SentimentBar shares={{ positive: 0.7, neutral: 0.1, negative: 0.2 }} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Negative 20.0%, Neutral 10.0%, Positive 70.0%");
  });

  it("prints every share beside the donut and handles no classified reviews", () => {
    const { unmount } = render(<SentimentDonutCard data={summary()} />);
    const shares = screen.getByRole("list", { name: "Sentiment shares" });
    expect(within(shares).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Positive70.0%70",
      "Neutral10.0%10",
      "Negative20.0%20",
    ]);
    unmount();
    const big = render(<SentimentDonutCard data={summary({ classified: 1_100_000 })} />);
    expect(screen.getByTitle("1,100,000")).toHaveTextContent("1.1M"); // fits inside the ring
    big.unmount();
    render(<SentimentDonutCard data={summary({ classified: 0 })} />);
    expect(screen.getByText("No classified reviews match this selection.")).toBeInTheDocument();
  });
});

describe("SentimentBreakdownCard", () => {
  const data: SentimentBreakdown = {
    by: "product",
    min_classified: 50,
    groups_total: 1,
    items: [group("P1", { name: "Synthetic Serum", brand_name: "Alpha Labs" })],
  };

  it("links products and changes dimension, sort and minimum", () => {
    render(<SentimentBreakdownCard data={data} state={{ ...DEFAULT_SENTIMENT_STATE, by: "product" }} />);
    expect(screen.getByRole("link", { name: "Synthetic Serum" })).toHaveAttribute("href", "/products/P1");
    expect(screen.getByText("+50.0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Subcategory" }));
    expect(lastQuery()).toBe("by=subcategory");
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "negative_share" } });
    expect(lastQuery()).toBe("by=product&sort=negative_share");
  });

  it("explains an empty breakdown", () => {
    render(<SentimentBreakdownCard data={{ ...data, items: [], groups_total: 0 }} state={DEFAULT_SENTIMENT_STATE} />);
    expect(screen.getByText(/Lower the minimum/)).toBeInTheDocument();
  });
});

describe("CompareSentiment", () => {
  const product = (id: string, records: number) =>
    ({ product_id: id, product_name: `Product ${id}`, review_stats: { review_record_count: records } }) as unknown as ComparedProduct;

  it("shows sentiment only for classified products", () => {
    render(
      <CompareSentiment
        items={[product("P1", 80), product("P2", 40), product("P3", 0)]}
        data={{ by: "product", min_classified: 1, groups_total: 1, items: [group("P1")] }}
      />,
    );
    expect(screen.getByText(/60 of 80 classified/)).toBeInTheDocument();
    expect(screen.getByText("Not classified yet")).toBeInTheDocument();
    expect(screen.getByText("No review records")).toBeInTheDocument();
  });

  it("keeps the honest placeholder when nothing is classified", () => {
    render(<CompareSentiment items={[product("P1", 10)]} data={null} />);
    expect(screen.getByText("No sentiment results for these products yet.")).toBeInTheDocument();
  });
});
