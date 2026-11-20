import type { Metadata } from "next";
import { connection } from "next/server";
import { api } from "@/lib/api/client";
import type { FilterOptions } from "@/lib/api/types";
import type { RawSearchParams } from "@/lib/filters";
import { formatInteger } from "@/lib/format";
import {
  PRODUCT_PAGE_SIZE,
  hasProductFilters,
  parseProductFilters,
  toProductApiParams,
  toProductSearchParams,
  type ProductDomain,
} from "@/lib/productFilters";
import { settle } from "@/lib/settle";
import { PageHeader } from "@/components/layout/PageHeader";
import { PendingFrame } from "@/components/layout/NavigationTransition";
import { ProductFilterBar } from "@/components/products/ProductFilterBar";
import { ProductTable } from "@/components/products/ProductTable";
import { ApiUnavailable } from "@/components/ui/ApiUnavailable";
import { Pagination } from "@/components/ui/Pagination";
import { ScopeTag } from "@/components/ui/ScopeTag";
import { EmptyState, SectionError } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Product Analytics · Sephora Business Insight",
  description: "Search, filter and rank the Sephora product catalogue.",
};

const HEADER = {
  eyebrow: "Product analytics",
  title: "Product catalogue",
  description:
    "Search, filter and rank all Sephora products. Open a product for its review records, rating trend and insights.",
};

function domainFrom(options: FilterOptions): ProductDomain {
  const c = options.catalogue;
  return {
    categories: c.primary_categories.map((x) => x.name),
    subcategories: Object.fromEntries(
      Object.entries(c.secondary_categories).map(([k, v]) => [k, v.map((x) => x.name)]),
    ),
    brands: c.brands,
    priceMax: Math.ceil(c.price_max),
  };
}

export default async function ProductAnalytics({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await connection();

  let options: FilterOptions;
  try {
    options = await api.filters();
  } catch (e) {
    return <ApiUnavailable {...HEADER} error={e} />;
  }

  const filters = parseProductFilters(await searchParams, domainFrom(options));
  const result = await settle(api.products(toProductApiParams(filters)));
  const query = toProductSearchParams(filters).toString();
  const catalogueTotal = options.catalogue.primary_categories.reduce((a, c) => a + c.count, 0);

  return (
    <>
      <PageHeader
        {...HEADER}
        meta={
          <span>
            {formatInteger(catalogueTotal)} products · {formatInteger(options.catalogue.brands.length)} brands
          </span>
        }
        filters={
          <ProductFilterBar
            filters={filters}
            categories={options.catalogue.primary_categories}
            subcategories={options.catalogue.secondary_categories}
            brands={options.catalogue.brands}
          />
        }
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <PendingFrame>
          <section aria-labelledby="results-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <ScopeTag scope="catalogue" />
                <h2 id="results-heading" className="mt-2 text-[15px] font-semibold text-charcoal">
                  {result.ok
                    ? `${formatInteger(result.value.total)} ${result.value.total === 1 ? "product" : "products"}${
                        hasProductFilters(filters) ? " match" : ""
                      }`
                    : "Products"}
                </h2>
              </div>
              <p className="max-w-xl text-xs text-ink-3">
                Rating and Reviews are Sephora&apos;s catalogue figures. Review records are rows in the review
                dataset, which covers Skincare products only.
              </p>
            </div>

            {!result.ok ? (
              <SectionError message={result.error} />
            ) : result.value.total === 0 ? (
              <EmptyState message="No products match these filters. Try widening the price range or clearing a filter." />
            ) : result.value.items.length === 0 ? (
              <EmptyState message="This page is past the end of the results." />
            ) : (
              <ProductTable items={result.value.items} filters={filters} />
            )}

            {result.ok && (
              <Pagination
                page={filters.page}
                totalPages={result.value.total_pages}
                total={result.value.total}
                pageSize={PRODUCT_PAGE_SIZE}
                query={query}
                noun={["product", "products"]}
                label="Product pages"
              />
            )}
          </section>
        </PendingFrame>
      </main>
    </>
  );
}
