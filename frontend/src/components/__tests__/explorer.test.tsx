import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ColumnProfile, TableProfile } from "@/lib/api/types";
import {
  parseExplorerState,
  toExplorerSearchParams,
  toProductRecordParams,
  toReviewRecordParams,
  withExplorerChanges,
} from "@/lib/explorerState";
import { ColumnDictionary, MissingValuesCard, columnSummary } from "@/components/explorer/ColumnDictionary";
import { ExplorerFilters } from "@/components/explorer/ExplorerFilters";
import { QualityChecks } from "@/components/explorer/QualityChecks";
import { ReviewRecords } from "@/components/explorer/RecordTables";

const setQuery = vi.fn();
vi.mock("@/components/layout/NavigationTransition", () => ({
  useNavigationTransition: () => ({ isPending: false, setQuery }),
}));
const lastQuery = () => setQuery.mock.calls.at(-1)![0].toString();
beforeEach(() => setQuery.mockClear());

const domain = { categories: ["Skincare", "Makeup"], subcategories: ["Cleansers", "Masks"] };

// Synthetic profile — not real dataset values.
const col = (name: string, overrides: Partial<ColumnProfile> = {}): ColumnProfile => ({
  name,
  kind: "number",
  description: `About ${name}`,
  exposed: true,
  non_null: 90,
  missing: 10,
  missing_share: 0.1,
  distinct: null,
  min: 1,
  max: 5,
  mean: 3.5,
  median: 4,
  date_min: null,
  date_max: null,
  median_length: null,
  ...overrides,
});

const table: TableProfile = {
  name: "reviews",
  label: "Review records",
  source: "reviews_0-1.csv",
  description: "One row per review.",
  row_count: 100,
  columns: [
    col("reviewer_id (withheld)", { kind: "identifier", exposed: false, non_null: null, missing: null, missing_share: null }),
    col("rating", { missing: 0, missing_share: 0, non_null: 100 }),
    col("skin_type", { kind: "category", distinct: 4, missing: 25, missing_share: 0.25, min: null, max: null }),
    col("helpfulness"),
  ],
  dropped_columns: { "Unnamed: 0": "Row counter." },
};

describe("explorer state", () => {
  it("defaults to the product catalogue and validates per dataset", () => {
    expect(parseExplorerState({}, domain)).toMatchObject({ ds: "products", sort: "loves", page: 1 });
    const s = parseExplorerState({ ds: "reviews", subcategory: "Masks", rating: "2", category: "Skincare", sort: "loves" }, domain);
    expect(s).toMatchObject({ ds: "reviews", subcategory: "Masks", rating: 2, category: undefined, sort: "recent" });
  });

  it("round-trips through the URL", () => {
    const s = parseExplorerState({ ds: "reviews", q: "dry skin", rating: "5", sort: "helpful", page: "3" }, domain);
    expect(parseExplorerState(Object.fromEntries(toExplorerSearchParams(s)), domain)).toEqual(s);
    expect(toExplorerSearchParams(parseExplorerState({}, domain)).toString()).toBe("");
  });

  it("starts fresh when switching dataset", () => {
    const s = parseExplorerState({ ds: "reviews", q: "glow", rating: "4", page: "5" }, domain);
    expect(withExplorerChanges(s, { ds: "products" })).toEqual({ ds: "products", sort: "loves", page: 1 });
    expect(withExplorerChanges(s, { rating: 5 }).page).toBe(1);
  });

  it("maps to whitelisted API sorts", () => {
    const p = parseExplorerState({ category: "Makeup", sort: "price_asc" }, domain);
    expect(toProductRecordParams(p)).toMatchObject({ primary_category: ["Makeup"], sort_by: "price_usd", order: "asc", page_size: 25 });
    const r = parseExplorerState({ ds: "reviews", sort: "lowest" }, domain);
    expect(toReviewRecordParams(r)).toMatchObject({ sort_by: "rating", order: "asc" });
  });
});

describe("ExplorerFilters", () => {
  it("switches dataset and shows that dataset's filters", () => {
    render(<ExplorerFilters state={parseExplorerState({}, domain)} categories={domain.categories} subcategories={domain.subcategories} />);
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review records" }));
    expect(lastQuery()).toBe("ds=reviews");
  });

  it("filters review records by rating", () => {
    render(
      <ExplorerFilters state={parseExplorerState({ ds: "reviews" }, domain)} categories={domain.categories} subcategories={domain.subcategories} />,
    );
    fireEvent.change(screen.getByLabelText("Star rating"), { target: { value: "1" } });
    expect(lastQuery()).toBe("ds=reviews&rating=1");
  });
});

describe("column profile views", () => {
  it("summarises values by kind and marks withheld columns", () => {
    expect(columnSummary(table.columns[0])).toBe("Withheld");
    expect(columnSummary(table.columns[1])).toBe("1 – 5 · median 4");
    expect(columnSummary(table.columns[2])).toBe("4 distinct");
    expect(columnSummary(col("when", { kind: "date", date_min: "2019-01-05", date_max: "2023-03-01" }))).toMatch(/2019.*2023/);
    expect(columnSummary(col("text", { kind: "text", median_length: 210 }))).toBe("Median 210 characters");
  });

  it("lists only columns with gaps, largest first", () => {
    render(<MissingValuesCard table={table} />);
    const list = screen.getByRole("list", { name: /Missing values by column/ });
    const rows = within(list).getAllByRole("listitem").map((li) => li.textContent);
    expect(rows[0]).toContain("skin_type");
    expect(rows[1]).toContain("helpfulness");
    expect(rows).toHaveLength(2);
    expect(screen.getByText(/2 of 3 columns have gaps; 1 are complete/)).toBeInTheDocument();
  });

  it("renders the dictionary with dropped columns", () => {
    render(<ColumnDictionary table={table} />);
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("Withheld")).toBeInTheDocument();
    expect(within(rows[3]).getByText("(25.0%)")).toBeInTheDocument();
    expect(screen.getByText("Unnamed: 0")).toBeInTheDocument();
  });
});

describe("QualityChecks", () => {
  it("labels status in text, not colour alone", () => {
    render(
      <QualityChecks
        checks={[
          { name: "Ratings within 1–5", status: "pass", value: "0 out of range", detail: "Whole stars." },
          { name: "Catalogue prices present", status: "warn", value: "3 missing", detail: "Excluded." },
          { name: "Reviews with text", status: "info", value: "99%", detail: "Count anyway." },
        ]}
      />,
    );
    expect(screen.getByText("1 passed · 1 to review · 1 informational")).toBeInTheDocument();
    expect(screen.getByText("Pass.")).toBeInTheDocument();
    expect(screen.getByText("Review.")).toBeInTheDocument();
  });
});

describe("ReviewRecords", () => {
  it("never renders a reviewer identifier column", () => {
    render(
      <ReviewRecords
        items={[
          {
            review_id: "r_1",
            product_id: "P1",
            product_name: "Synthetic Serum",
            brand_name: "Alpha",
            subcategory: "Treatments",
            rating: 4,
            is_recommended: true,
            helpfulness: 1,
            total_feedback_count: 2,
            total_pos_feedback_count: 2,
            total_neg_feedback_count: 0,
            submission_date: "2022-05-09",
            review_title: "Good",
            review_text: "Fine.",
            skin_tone: null,
            skin_type: "dry",
            eye_color: null,
            hair_color: null,
          },
        ]}
      />,
    );
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent ?? "");
    expect(headers.some((h) => /author|reviewer/i.test(h))).toBe(false);
    expect(screen.getByRole("link", { name: "P1" })).toHaveAttribute("href", "/products/P1");
  });
});
