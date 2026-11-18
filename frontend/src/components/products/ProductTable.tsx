"use client";

import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ProductItem, ProductSortField } from "@/lib/api/types";
import { formatInteger, formatRating, formatUsd } from "@/lib/format";
import { toProductSearchParams, toggleSort, type ProductFilters } from "@/lib/productFilters";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";

interface Column {
  key: string;
  label: string;
  title?: string;
  sort?: ProductSortField;
  align?: "right";
  className?: string;
}

const COLUMNS: Column[] = [
  { key: "product", label: "Product", sort: "product_name", className: "min-w-[220px]" },
  { key: "brand", label: "Brand", sort: "brand_name" },
  { key: "category", label: "Category" },
  { key: "price", label: "Price", sort: "price_usd", align: "right" },
  {
    key: "rating",
    label: "Rating",
    sort: "catalogue_rating",
    align: "right",
    title: "Sephora's catalogue rating (all categories)",
  },
  {
    key: "reviews",
    label: "Reviews",
    sort: "sephora_review_count",
    align: "right",
    title: "Sephora-listed review count from the catalogue — not the review records",
  },
  {
    key: "records",
    label: "Review records",
    sort: "review_record_count",
    align: "right",
    title: "Rows in the review CSV files (Skincare products only)",
  },
  { key: "loves", label: "Loves", sort: "loves_count", align: "right", title: "Popularity: times added to Loves" },
];

const FLAG_LABELS: [keyof ProductItem, string][] = [
  ["new", "New"],
  ["sephora_exclusive", "Exclusive"],
  ["limited_edition", "Limited"],
  ["online_only", "Online only"],
  ["out_of_stock", "Out of stock"],
];

export function ProductFlags({ product }: { product: ProductItem }) {
  const flags = FLAG_LABELS.filter(([k]) => product[k]);
  if (!flags.length) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-1" aria-label="Catalogue flags">
      {flags.map(([k, label]) => (
        <li
          key={k}
          className={`rounded-full px-1.5 py-px text-[10px] font-medium ${
            k === "out_of_stock" ? "bg-light-gray text-ink-2" : "bg-soft-pink text-burgundy"
          }`}
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

export function ProductTable({ items, filters }: { items: ProductItem[]; filters: ProductFilters }) {
  const { setQuery } = useNavigationTransition();

  return (
    <div className="overflow-x-auto rounded-xl border border-line" tabIndex={0} aria-label="Product results, scrollable">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Products matching the current filters</caption>
        <thead className="bg-light-gray">
          <tr>
            {COLUMNS.map((c) => {
              const active = c.sort === filters.sort;
              const ariaSort = active ? (filters.order === "asc" ? "ascending" : "descending") : undefined;
              const Icon = !active ? ArrowUpDown : filters.order === "asc" ? ArrowUp : ArrowDown;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={ariaSort}
                  title={c.title}
                  className={`whitespace-nowrap px-3 py-2.5 text-xs font-medium text-ink-2 ${
                    c.align === "right" ? "text-right" : "text-left"
                  } ${c.className ?? ""}`}
                >
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() => setQuery(toProductSearchParams(toggleSort(filters, c.sort!)))}
                      className={`inline-flex items-center gap-1 rounded transition-colors hover:text-charcoal ${
                        active ? "text-burgundy" : ""
                      } ${c.align === "right" ? "flex-row-reverse" : ""}`}
                    >
                      {c.label}
                      <Icon aria-hidden className={`h-3 w-3 ${active ? "" : "opacity-50"}`} strokeWidth={2} />
                      <span className="sr-only">{active ? "" : ", sortable"}</span>
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.product_id} className="border-t border-line align-top transition-colors hover:bg-soft-pink/40">
              <td className="px-3 py-2.5">
                <Link
                  href={`/products/${p.product_id}`}
                  className="font-medium text-charcoal underline-offset-2 hover:text-burgundy hover:underline"
                >
                  {p.product_name}
                </Link>
                <ProductFlags product={p} />
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-ink-2">{p.brand_name}</td>
              <td className="px-3 py-2.5 text-ink-2">
                <span className="block whitespace-nowrap">{p.primary_category}</span>
                {p.secondary_category && (
                  <span className="block whitespace-nowrap text-xs text-ink-3">{p.secondary_category}</span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-charcoal">
                {formatUsd(p.price_usd)}
                {p.sale_price_usd !== null && (
                  <span className="block text-xs text-burgundy">Sale {formatUsd(p.sale_price_usd)}</span>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-charcoal">
                {p.catalogue_rating === null ? <span className="text-ink-3">—</span> : `★ ${formatRating(p.catalogue_rating)}`}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-charcoal">
                {p.sephora_review_count === null ? (
                  <span className="text-ink-3">—</span>
                ) : (
                  formatInteger(p.sephora_review_count)
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-charcoal">
                {p.review_record_count > 0 ? formatInteger(p.review_record_count) : <span className="text-ink-3">—</span>}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-charcoal">{formatInteger(p.loves_count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
