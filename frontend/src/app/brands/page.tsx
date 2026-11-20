import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft } from "lucide-react";
import { ApiError, api } from "@/lib/api/client";
import type { BrandItem, FilterOptions, ReviewFilterParams } from "@/lib/api/types";
import type { RawSearchParams } from "@/lib/filters";
import { formatInteger, formatPercent, formatRating, plural } from "@/lib/format";
import {
  brandHref,
  hasBrandReviewFilters,
  parseBrandState,
  toBrandListParams,
  type BrandDomain,
} from "@/lib/brandFilters";
import { settle } from "@/lib/settle";
import { PageHeader } from "@/components/layout/PageHeader";
import { PendingFrame } from "@/components/layout/NavigationTransition";
import { BrandDirectory } from "@/components/brands/BrandDirectory";
import { BrandFilterBar } from "@/components/brands/BrandFilterBar";
import { BrandFocus } from "@/components/brands/BrandFocus";
import { BrandLandscapeCard } from "@/components/brands/BrandLandscapeCard";
import { RankedBarList } from "@/components/charts/RankedBarList";
import { ApiUnavailable } from "@/components/ui/ApiUnavailable";
import { ChartCard } from "@/components/ui/ChartCard";
import { ScopeTag } from "@/components/ui/ScopeTag";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState, SectionError } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Brands & Categories · Sephora Business Insight",
  description: "Brand and category performance across the Sephora catalogue and its Skincare reviews.",
};

const HEADER = {
  eyebrow: "Brands & categories",
  title: "Brand and category performance",
  description:
    "Which brands lead on review volume and ratings, how the catalogue is spread across categories, and how each brand compares. Select any brand to focus it.",
};

function domainFrom(options: FilterOptions): BrandDomain {
  return {
    brands: options.catalogue.brands,
    categories: options.catalogue.primary_categories.map((c) => c.name),
    subcategories: options.reviews.subcategories.map((s) => s.name),
  };
}

export default async function BrandsAndCategories({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await connection();

  let options: FilterOptions;
  try {
    options = await api.filters();
  } catch (e) {
    return <ApiUnavailable {...HEADER} error={e} />;
  }

  let state = parseBrandState(await searchParams, domainFrom(options));

  let focusBrand: BrandItem | undefined;
  if (state.brand) {
    try {
      focusBrand = await api.brand(state.brand);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) state = { ...state, brand: undefined };
    }
  }

  const f: ReviewFilterParams = { subcategory: state.subcategory ? [state.subcategory] : undefined };
  const bf: ReviewFilterParams = { ...f, brand: focusBrand ? [focusBrand.brand_name] : undefined };
  const focused = !!focusBrand;

  const [
    kpis,
    mostReviewed,
    highestRated,
    landscape,
    productCounts,
    categoryMix,
    subcats,
    directory,
    focusKpis,
    focusMix,
    focusSubcats,
    focusTop,
  ] = await Promise.all([
    settle(api.kpis(f)),
    settle(api.topBrands(f, 10)),
    settle(api.brandReviewStats(f, { sortBy: "average_rating", minReviews: state.minReviews, limit: 10 })),
    settle(api.brandReviewStats(f, { sortBy: "review_count", minReviews: state.minReviews, limit: 500 })),
    settle(api.brands({ sort_by: "product_count", order: "desc", page_size: 10 })),
    settle(api.catalogueCategories(state.category)),
    settle(api.reviewCategories({})),
    settle(api.brands(toBrandListParams(state))),
    focused ? settle(api.kpis(bf)) : null,
    focused ? settle(api.catalogueCategories(undefined, focusBrand!.brand_name)) : null,
    focused ? settle(api.reviewCategories(bf)) : null,
    focused ? settle(api.topProducts(bf, 5)) : null,
  ]);

  const catalogueBrands = options.catalogue.brands.length;
  const catalogueProducts = options.catalogue.primary_categories.reduce((a, c) => a + c.count, 0);
  const minLabel = `${formatInteger(state.minReviews)}+ reviews`;

  return (
    <>
      <PageHeader
        {...HEADER}
        meta={
          <span>
            {formatInteger(catalogueBrands)} brands · {formatInteger(options.catalogue.primary_categories.length)} categories
            <br className="hidden sm:block" />
            <span className="sm:hidden"> · </span>
            {hasBrandReviewFilters(state) ? `Reviews: ${state.subcategory}` : "Reviews: all Skincare subcategories"}
          </span>
        }
        filters={<BrandFilterBar state={state} brands={options.catalogue.brands} subcategories={options.reviews.subcategories} />}
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <PendingFrame>
          <div className="space-y-6">
            <section aria-labelledby="brand-kpi-heading" className="grid gap-4 lg:grid-cols-2">
              <h2 id="brand-kpi-heading" className="sr-only">
                Brand and category summary
              </h2>
              <div className="rounded-xl border border-line bg-white p-5">
                <ScopeTag scope="catalogue" />
                <dl className="mt-4 grid grid-cols-3 gap-4">
                  <StatTile label="Brands" value={formatInteger(catalogueBrands)} />
                  <StatTile label="Products" value={formatInteger(catalogueProducts)} />
                  <StatTile
                    label="Products per brand"
                    value={catalogueBrands ? (catalogueProducts / catalogueBrands).toFixed(1) : "—"}
                    note="Mean"
                  />
                </dl>
              </div>
              <div className="rounded-xl border border-line bg-white p-5">
                <ScopeTag scope="reviews" />
                <dl className="mt-4 grid grid-cols-3 gap-4">
                  <StatTile
                    label="Brands with reviews"
                    value={kpis.ok ? formatInteger(kpis.value.reviews.reviewed_brands) : "—"}
                  />
                  <StatTile
                    label={`Brands with ${minLabel}`}
                    value={landscape.ok ? formatInteger(landscape.value.brands_meeting_threshold) : "—"}
                  />
                  <StatTile
                    label="Leading brand's share"
                    value={mostReviewed.ok && mostReviewed.value.items[0] ? formatPercent(mostReviewed.value.items[0].share) : "—"}
                    note={mostReviewed.ok ? mostReviewed.value.items[0]?.brand_name : undefined}
                  />
                </dl>
              </div>
            </section>

            {focusBrand && focusKpis && focusMix && focusSubcats && focusTop && (
              <BrandFocus
                state={state}
                brand={focusBrand}
                kpis={focusKpis}
                categoryMix={focusMix}
                brandSubcats={focusSubcats}
                allSubcats={subcats}
                topProducts={focusTop}
              />
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard title="Most reviewed brands" subtitle="Top 10 by review records · select a brand to focus it" scope="reviews">
                {!mostReviewed.ok ? (
                  <SectionError message={mostReviewed.error} />
                ) : mostReviewed.value.items.length === 0 ? (
                  <EmptyState />
                ) : (
                  <RankedBarList
                    ariaLabel="Most reviewed brands"
                    items={mostReviewed.value.items.map((b) => ({
                      key: b.brand_name,
                      label: b.brand_name,
                      sublabel: plural(b.reviewed_products, "product"),
                      value: b.review_count,
                      display: formatInteger(b.review_count),
                      secondary: `${formatPercent(b.share)} · ★ ${formatRating(b.average_rating)}`,
                      href: brandHref(state, { brand: b.brand_name }, "brand-focus"),
                      hrefLabel: `Focus ${b.brand_name}`,
                    }))}
                  />
                )}
              </ChartCard>

              <ChartCard
                title="Highest-rated brands"
                subtitle={`Average review rating, brands with ${minLabel} only · bars on the 0–5 scale`}
                scope="reviews"
              >
                {!highestRated.ok ? (
                  <SectionError message={highestRated.error} />
                ) : highestRated.value.items.length === 0 ? (
                  <EmptyState
                    message={`No brand has ${minLabel} in this selection. Lower the minimum to rank more brands.`}
                  />
                ) : (
                  <RankedBarList
                    ariaLabel="Highest-rated brands"
                    max={5}
                    items={highestRated.value.items.map((b) => ({
                      key: b.brand_name,
                      label: b.brand_name,
                      value: b.average_rating,
                      display: formatRating(b.average_rating),
                      secondary: `${formatInteger(b.review_count)} reviews`,
                      href: brandHref(state, { brand: b.brand_name }, "brand-focus"),
                      hrefLabel: `Focus ${b.brand_name}`,
                    }))}
                  />
                )}
              </ChartCard>
            </div>

            {landscape.ok ? (
              <BrandLandscapeCard data={landscape.value} state={state} />
            ) : (
              <SectionError message={landscape.error} />
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard
                title={state.category ? `${state.category}: products by subcategory` : "Products by catalogue category"}
                subtitle={
                  state.category
                    ? "Catalogue subcategories of the selected category"
                    : "All primary categories · select a category to see its subcategories"
                }
                scope="catalogue"
                action={
                  state.category ? (
                    <Link
                      href={brandHref(state, { category: undefined })}
                      scroll={false}
                      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-ink-2 transition-colors hover:bg-light-gray hover:text-charcoal"
                    >
                      <ChevronLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                      All categories
                    </Link>
                  ) : undefined
                }
                table={
                  categoryMix.ok
                    ? {
                        columns: [
                          { key: "category", label: "Category" },
                          { key: "products", label: "Products", align: "right" },
                          { key: "share", label: "Share", align: "right" },
                          { key: "brands", label: "Brands", align: "right" },
                          { key: "rating", label: "Avg catalogue rating", align: "right" },
                        ],
                        rows: categoryMix.value.items.map((c) => ({
                          category: c.category,
                          products: formatInteger(c.product_count),
                          share: formatPercent(c.share_of_products),
                          brands: formatInteger(c.brand_count),
                          rating: c.average_catalogue_rating === null ? "—" : formatRating(c.average_catalogue_rating),
                        })),
                      }
                    : undefined
                }
              >
                {!categoryMix.ok ? (
                  <SectionError message={categoryMix.error} />
                ) : (
                  <RankedBarList
                    ariaLabel={state.category ? `${state.category} products by subcategory` : "Products by category"}
                    items={categoryMix.value.items.map((c) => ({
                      key: c.category,
                      label: c.category,
                      sublabel: plural(c.brand_count, "brand"),
                      value: c.product_count,
                      display: formatInteger(c.product_count),
                      secondary: formatPercent(c.share_of_products),
                      href: state.category ? undefined : brandHref(state, { category: c.category }),
                      hrefLabel: `Show ${c.category} subcategories`,
                    }))}
                  />
                )}
              </ChartCard>

              <ChartCard title="Product counts by brand" subtitle="Top 10 brands by number of catalogue products" scope="catalogue">
                {!productCounts.ok ? (
                  <SectionError message={productCounts.error} />
                ) : (
                  <RankedBarList
                    ariaLabel="Product counts by brand"
                    items={productCounts.value.items.map((b) => ({
                      key: b.brand_name,
                      label: b.brand_name,
                      sublabel: plural(b.category_count, "category", "categories"),
                      value: b.product_count,
                      display: formatInteger(b.product_count),
                      href: brandHref(state, { brand: b.brand_name }, "brand-focus"),
                      hrefLabel: `Focus ${b.brand_name}`,
                    }))}
                  />
                )}
              </ChartCard>
            </div>

            <ChartCard
              title={`Average rating by ${options.reviews.scope_category} subcategory`}
              subtitle="All review records · bars on the 0–5 scale · select a subcategory to scope the brand rankings"
              scope="reviews"
              table={
                subcats.ok
                  ? {
                      columns: [
                        { key: "sub", label: "Subcategory" },
                        { key: "reviews", label: "Reviews", align: "right" },
                        { key: "rating", label: "Avg rating", align: "right" },
                        { key: "five", label: "5★ share", align: "right" },
                        { key: "rec", label: "Recommend rate", align: "right" },
                        { key: "products", label: "Products", align: "right" },
                      ],
                      rows: subcats.value.items.map((c) => ({
                        sub: c.subcategory,
                        reviews: formatInteger(c.review_count),
                        rating: formatRating(c.average_rating),
                        five: formatPercent(c.five_star_share),
                        rec: c.recommendation_rate === null ? "—" : formatPercent(c.recommendation_rate),
                        products: formatInteger(c.reviewed_products),
                      })),
                    }
                  : undefined
              }
            >
              {!subcats.ok ? (
                <SectionError message={subcats.error} />
              ) : subcats.value.items.length === 0 ? (
                <EmptyState />
              ) : (
                <RankedBarList
                  ariaLabel={`Average rating by ${options.reviews.scope_category} subcategory`}
                  max={5}
                  items={[...subcats.value.items]
                    .sort((a, b) => b.average_rating - a.average_rating || b.review_count - a.review_count)
                    .map((c) => ({
                      key: c.subcategory,
                      label: c.subcategory,
                      sublabel: state.subcategory === c.subcategory ? "selected" : undefined,
                      value: c.average_rating,
                      display: formatRating(c.average_rating),
                      secondary: `${formatInteger(c.review_count)} reviews`,
                      href: state.subcategory === c.subcategory ? undefined : brandHref(state, { subcategory: c.subcategory }),
                      hrefLabel: `Scope brand rankings to ${c.subcategory}`,
                    }))}
                />
              )}
            </ChartCard>

            <section aria-labelledby="brand-directory-heading" className="rounded-xl border border-line bg-white p-5 sm:p-6">
              <ScopeTag scope="catalogue" />
              <h2 id="brand-directory-heading" className="mt-2 text-[15px] font-semibold text-charcoal">
                Brand directory
              </h2>
              <p className="mt-0.5 mb-5 text-xs text-ink-3">
                All catalogue brands. Sephora reviews are the catalogue&apos;s own counts; review records and their
                average rating come from the Skincare review dataset. Select a brand to focus it.
              </p>
              {directory.ok ? (
                <BrandDirectory brands={directory.value} state={state} />
              ) : (
                <SectionError message={directory.error} />
              )}
            </section>
          </div>
        </PendingFrame>
      </main>
    </>
  );
}
