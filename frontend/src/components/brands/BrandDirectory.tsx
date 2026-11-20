"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { BrandItem, BrandSortField, Page } from "@/lib/api/types";
import { formatCompact, formatInteger, formatRating, formatUsd } from "@/lib/format";
import {
  BRAND_PAGE_SIZE,
  brandHref,
  toBrandSearchParams,
  toggleBrandSort,
  withBrandChanges,
  type BrandPageState,
} from "@/lib/brandFilters";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";
import { Pagination } from "@/components/ui/Pagination";
import { SearchField } from "@/components/ui/SearchField";
import { EmptyState } from "@/components/ui/States";

interface Column {
  key: string;
  label: string;
  sort?: BrandSortField;
  title?: string;
  align?: "right";
}

const COLUMNS: Column[] = [
  { key: "brand", label: "Brand", sort: "brand_name" },
  { key: "products", label: "Products", sort: "product_count", align: "right" },
  { key: "categories", label: "Categories", align: "right", title: "Catalogue primary categories the brand sells in" },
  { key: "price", label: "Avg price", sort: "average_price", align: "right" },
  { key: "loves", label: "Loves", sort: "loves_count", align: "right" },
  {
    key: "sephora",
    label: "Sephora reviews",
    sort: "sephora_review_count",
    align: "right",
    title: "Sephora-listed review count from the catalogue — not the review records",
  },
  {
    key: "records",
    label: "Review records",
    sort: "review_record_count",
    align: "right",
    title: "Rows in the review dataset (Skincare only)",
  },
  {
    key: "rating",
    label: "Avg rating",
    sort: "review_average_rating",
    align: "right",
    title: "Mean rating of the review records",
  },
];

function SortHeader({ col, state }: { col: Column; state: BrandPageState }) {
  const { setQuery } = useNavigationTransition();
  const active = col.sort === state.sort;
  const Icon = !active ? ArrowUpDown : state.order === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      title={col.title}
      aria-sort={active ? (state.order === "asc" ? "ascending" : "descending") : undefined}
      className={`whitespace-nowrap px-4 py-2.5 font-medium ${col.align === "right" ? "text-right" : ""}`}
    >
      {col.sort ? (
        <button
          type="button"
          onClick={() => setQuery(toBrandSearchParams(toggleBrandSort(state, col.sort!)))}
          className={`inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-charcoal ${
            active ? "text-burgundy" : ""
          }`}
        >
          {col.label}
          <Icon aria-hidden className="h-3 w-3" strokeWidth={2} />
        </button>
      ) : (
        col.label
      )}
    </th>
  );
}

export function BrandDirectory({ brands, state }: { brands: Page<BrandItem>; state: BrandPageState }) {
  const { setQuery } = useNavigationTransition();
  return (
    <div className="space-y-4">
      <SearchField
        key={state.q ?? ""}
        id="brand-search"
        label="Search brands"
        placeholder="e.g. glow, LANEIGE"
        value={state.q ?? ""}
        onSearch={(q) => setQuery(toBrandSearchParams(withBrandChanges(state, { q })))}
      />

      {brands.total === 0 ? (
        <EmptyState message={state.q ? `No brand name contains “${state.q}”.` : "No brands."} />
      ) : brands.items.length === 0 ? (
        <EmptyState message="This page is past the end of the results." />
      ) : (
        <div className="relative overflow-x-auto rounded-lg border border-line" tabIndex={0} aria-label="Brand directory, scrollable">
          <table className="w-full min-w-[860px] text-left text-sm">
            <caption className="sr-only">Brand directory</caption>
            <thead className="bg-light-gray text-[11px] font-medium uppercase tracking-wide text-ink-3">
              <tr>
                {COLUMNS.map((c) => (
                  <SortHeader key={c.key} col={c} state={state} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {brands.items.map((b) => (
                <tr
                  key={b.brand_name}
                  className={`transition-colors hover:bg-soft-pink/40 ${state.brand === b.brand_name ? "bg-soft-pink/60" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={brandHref(state, { brand: b.brand_name }, "brand-focus")}
                      scroll={false}
                      aria-label={`Focus ${b.brand_name}`}
                      className="font-medium text-charcoal hover:text-burgundy hover:underline"
                    >
                      {b.brand_name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatInteger(b.product_count)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{formatInteger(b.category_count)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{formatUsd(b.average_price_usd)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{formatCompact(b.loves_count)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">{formatInteger(b.sephora_review_count)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-charcoal">
                    {b.review_record_count ? formatInteger(b.review_record_count) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-2">
                    {b.review_average_rating === null ? "—" : formatRating(b.review_average_rating)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        page={state.page}
        totalPages={brands.total_pages}
        total={brands.total}
        pageSize={BRAND_PAGE_SIZE}
        query={toBrandSearchParams(state).toString()}
        noun={["brand", "brands"]}
        label="Brand pages"
      />
    </div>
  );
}
