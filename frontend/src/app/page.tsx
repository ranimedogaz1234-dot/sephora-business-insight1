import { connection } from "next/server";
import { api } from "@/lib/api/client";
import type { FilterOptions } from "@/lib/api/types";
import { settle } from "@/lib/settle";
import {
  hasReviewFilters,
  parseFilters,
  periodLabel,
  toApiParams,
  type FilterDomain,
  type RawSearchParams,
} from "@/lib/filters";
import { formatCompact, formatDate, formatInteger, formatPercent, formatRating, plural } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { PendingFrame } from "@/components/layout/NavigationTransition";
import { FilterBar } from "@/components/filters/FilterBar";
import { YearSelect } from "@/components/filters/YearSelect";
import { KpiSection } from "@/components/dashboard/KpiSection";
import { ChartCard } from "@/components/ui/ChartCard";
import { EmptyState, SectionError } from "@/components/ui/States";
import { ApiUnavailable } from "@/components/ui/ApiUnavailable";
import { RankedBarList } from "@/components/charts/RankedBarList";
import { ReviewActivityCard } from "@/components/charts/ReviewActivityCard";
import { RatingDistributionCard } from "@/components/charts/RatingDistributionCard";
import { ActivityHeatmapCard } from "@/components/charts/ActivityHeatmapCard";
import { PriceDistributionCard } from "@/components/charts/PriceDistributionCard";
import { RatingPopularityCard } from "@/components/charts/RatingPopularityCard";

const MIN_REVIEWS_SCATTER = 25;

function domainFrom(options: FilterOptions): FilterDomain {
  return {
    years: options.reviews.years.map((y) => y.year),
    dateMax: options.reviews.date_max ?? "",
    brands: options.reviews.brands.map((b) => b.name),
    subcategories: options.reviews.subcategories.map((s) => s.name),
  };
}

export default async function ExecutiveOverview({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await connection(); // always render live data

  let options: FilterOptions;
  try {
    options = await api.filters();
  } catch (e) {
    return (
      <ApiUnavailable
        eyebrow="Executive overview"
        title="Sephora Business Insight"
        description="Headline performance of the Sephora catalogue and its Skincare reviews."
        error={e}
      />
    );
  }

  const domain = domainFrom(options);
  const filters = parseFilters(await searchParams, domain);
  const f = toApiParams(filters, domain);

  const [kpis, ratings, trend, heatmap, topProducts, byYear, brands, reviewCats, catalogueCats, prices, popularity] =
    await Promise.all([
      settle(api.kpis(f)),
      settle(api.ratingDistribution(f)),
      settle(api.trend(f, "month")),
      settle(api.heatmap(f)),
      settle(api.topProducts(f, 10)),
      settle(api.topProductsByYear(filters.rankYear, f, 10)),
      settle(api.topBrands(f, 10)),
      settle(api.reviewCategories(f)),
      settle(api.catalogueCategories()),
      settle(api.priceDistribution(10, 300)),
      settle(api.ratingPopularity(f, MIN_REVIEWS_SCATTER, 3000)), // API maximum: plot every qualifying product
    ]);

  const filtered = hasReviewFilters(filters);

  return (
    <>
      <PageHeader
        eyebrow="Executive overview"
        title="Business performance at a glance"
        description={`Catalogue composition across all ${options.catalogue.primary_categories.length} categories, and what ${formatCompact(
          kpis.ok
            ? kpis.value.data_quality.review_records_total
            : options.reviews.years.reduce((sum, y) => sum + y.review_count, 0),
        )} ${options.reviews.scope_category} reviews say about ratings, products and brands.`}
        meta={
          <span>
            Reviews {formatDate(options.reviews.date_min)} – {formatDate(options.reviews.date_max)}
            <br className="hidden sm:block" />
            <span className="sm:hidden"> · </span>
            {filtered ? `Showing: ${periodLabel(filters, domain)}` : "Showing all review records"}
          </span>
        }
        filters={
          <FilterBar
            filters={filters}
            domain={domain}
            brands={options.reviews.brands}
            subcategories={options.reviews.subcategories}
          />
        }
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <PendingFrame>
          <div className="space-y-6">
            {kpis.ok ? <KpiSection kpis={kpis.value} /> : <SectionError message={kpis.error} />}

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="min-w-0 xl:col-span-2">
                {trend.ok ? <ReviewActivityCard points={trend.value.points} /> : <SectionError message={trend.error} />}
              </div>
              {ratings.ok ? <RatingDistributionCard data={ratings.value} /> : <SectionError message={ratings.error} />}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Top 10 most reviewed products"
                subtitle="Ranked by number of review records"
                scope="reviews"
              >
                {!topProducts.ok ? (
                  <SectionError message={topProducts.error} />
                ) : topProducts.value.length === 0 ? (
                  <EmptyState />
                ) : (
                  <RankedBarList
                    ariaLabel="Top 10 most reviewed products"
                    items={topProducts.value.map((p) => ({
                      key: p.product_id,
                      label: p.product_name,
                      sublabel: p.brand_name,
                      value: p.review_count,
                      display: formatInteger(p.review_count),
                      secondary: `★ ${formatRating(p.average_rating)}`,
                    }))}
                  />
                )}
              </ChartCard>

              <ChartCard
                title={`Most reviewed products in ${filters.rankYear}`}
                subtitle={
                  byYear.ok
                    ? `${formatInteger(byYear.value.total_reviews_in_year)} reviews in ${filters.rankYear}`
                    : undefined
                }
                scope="reviews"
                action={<YearSelect filters={filters} domain={domain} />}
              >
                {!byYear.ok ? (
                  <SectionError message={byYear.error} />
                ) : byYear.value.items.length === 0 ? (
                  <EmptyState message={`No reviews match the current filters in ${filters.rankYear}.`} />
                ) : (
                  <RankedBarList
                    ariaLabel={`Most reviewed products in ${filters.rankYear}`}
                    items={byYear.value.items.map((p) => ({
                      key: p.product_id,
                      label: p.product_name,
                      sublabel: p.brand_name,
                      value: p.review_count,
                      display: formatInteger(p.review_count),
                      secondary: `★ ${formatRating(p.average_rating)}`,
                    }))}
                  />
                )}
              </ChartCard>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard title="Top brands by review volume" subtitle="Share of review records" scope="reviews">
                {!brands.ok ? (
                  <SectionError message={brands.error} />
                ) : brands.value.items.length === 0 ? (
                  <EmptyState />
                ) : (
                  <RankedBarList
                    ariaLabel="Top brands by review volume"
                    items={brands.value.items.map((b) => ({
                      key: b.brand_name,
                      label: b.brand_name,
                      sublabel: plural(b.reviewed_products, "product"),
                      value: b.review_count,
                      display: formatInteger(b.review_count),
                      secondary: `${formatPercent(b.share)} · ★ ${formatRating(b.average_rating)}`,
                    }))}
                  />
                )}
              </ChartCard>

              <ChartCard
                title="Average rating by Skincare subcategory"
                subtitle="Bars run on the full 0–5 rating scale; review count shown beneath each rating"
                scope="reviews"
              >
                {!reviewCats.ok ? (
                  <SectionError message={reviewCats.error} />
                ) : reviewCats.value.items.length === 0 ? (
                  <EmptyState />
                ) : (
                  <RankedBarList
                    ariaLabel="Average rating by Skincare subcategory"
                    max={5}
                    items={[...reviewCats.value.items]
                      .sort((a, b) => b.average_rating - a.average_rating || b.review_count - a.review_count)
                      .map((c) => ({
                        key: c.subcategory,
                        label: c.subcategory,
                        value: c.average_rating,
                        display: formatRating(c.average_rating),
                        secondary: `${formatInteger(c.review_count)} reviews`,
                      }))}
                  />
                )}
              </ChartCard>
            </div>

            {heatmap.ok ? <ActivityHeatmapCard data={heatmap.value} /> : <SectionError message={heatmap.error} />}

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Product catalogue by category"
                subtitle={`Products per primary category, all ${options.catalogue.primary_categories.length} categories`}
                scope="catalogue"
              >
                {!catalogueCats.ok ? (
                  <SectionError message={catalogueCats.error} />
                ) : (
                  <RankedBarList
                    ariaLabel="Products per catalogue category"
                    items={catalogueCats.value.items.map((c) => ({
                      key: c.category,
                      label: c.category,
                      sublabel: plural(c.brand_count, "brand"),
                      value: c.product_count,
                      display: formatInteger(c.product_count),
                      secondary: formatPercent(c.share_of_products),
                    }))}
                  />
                )}
              </ChartCard>
              {prices.ok ? <PriceDistributionCard data={prices.value} /> : <SectionError message={prices.error} />}
            </div>

            {popularity.ok ? (
              <RatingPopularityCard data={popularity.value} minReviews={MIN_REVIEWS_SCATTER} />
            ) : (
              <SectionError message={popularity.error} />
            )}
          </div>
        </PendingFrame>
      </main>
    </>
  );
}
