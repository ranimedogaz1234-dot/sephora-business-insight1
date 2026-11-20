import type { Metadata } from "next";
import { connection } from "next/server";
import { ApiError, api } from "@/lib/api/client";
import type { FilterOptions } from "@/lib/api/types";
import type { RawSearchParams } from "@/lib/filters";
import { formatDate, formatInteger, formatRating, plural } from "@/lib/format";
import {
  hasReviewPageFilters,
  parseReviewState,
  reviewHref,
  toReviewFilterParams,
  toReviewTableParams,
  type ReviewDomain,
} from "@/lib/reviewFilters";
import { settle } from "@/lib/settle";
import { PageHeader } from "@/components/layout/PageHeader";
import { PendingFrame } from "@/components/layout/NavigationTransition";
import { RankedBarList } from "@/components/charts/RankedBarList";
import { RatingDistributionCard } from "@/components/charts/RatingDistributionCard";
import { ReviewActivityCard } from "@/components/charts/ReviewActivityCard";
import { ReviewFilterBar } from "@/components/reviews/ReviewFilterBar";
import { ReviewKpiBand } from "@/components/reviews/ReviewKpiBand";
import { ReviewTable } from "@/components/reviews/ReviewTable";
import { ReviewerProfilesCard } from "@/components/reviews/ReviewerProfilesCard";
import { TopReviewedProducts } from "@/components/reviews/TopReviewedProducts";
import { ApiUnavailable } from "@/components/ui/ApiUnavailable";
import { ChartCard } from "@/components/ui/ChartCard";
import { ScopeTag } from "@/components/ui/ScopeTag";
import { EmptyState, SectionError } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Review Analytics · Sephora Business Insight",
  description: "Ratings, review activity, brands, subcategories and reviewer profiles in the Skincare review records.",
};

const HEADER = {
  eyebrow: "Review analytics",
  title: "What customers say",
  description:
    "Ratings, review activity and reviewer profiles across the Skincare review records. Filter, drill into a brand, subcategory or product, and read the reviews behind the numbers.",
};

function domainFrom(options: FilterOptions): ReviewDomain {
  return {
    brands: options.reviews.brands.map((b) => b.name),
    subcategories: options.reviews.subcategories.map((s) => s.name),
    dateMin: options.reviews.date_min ?? "",
    dateMax: options.reviews.date_max ?? "",
  };
}

export default async function ReviewAnalytics({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await connection();

  let options: FilterOptions;
  try {
    options = await api.filters();
  } catch (e) {
    return <ApiUnavailable {...HEADER} error={e} />;
  }

  const domain = domainFrom(options);
  let state = parseReviewState(await searchParams, domain);

  // Resolve the product filter's name for its chip; an unknown product is dropped.
  let productName: string | undefined;
  if (state.product) {
    try {
      productName = (await api.product(state.product)).product_name;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) state = { ...state, product: undefined };
    }
  }

  const f = toReviewFilterParams(state);
  const [kpis, ratings, trend, brands, subcats, topProducts, profiles, table] = await Promise.all([
    settle(api.kpis(f)),
    settle(api.ratingDistribution(f)),
    settle(api.trend(f, "month")),
    settle(api.topBrands(f, 10)),
    settle(api.reviewCategories(f)),
    settle(api.topProducts(f, 10)),
    settle(api.reviewerProfiles(f)),
    settle(api.reviews(toReviewTableParams(state))),
  ]);

  const filtered = hasReviewPageFilters(state);

  return (
    <>
      <PageHeader
        {...HEADER}
        meta={
          <span>
            {options.reviews.scope_category} reviews {formatDate(options.reviews.date_min)} –{" "}
            {formatDate(options.reviews.date_max)}
            <br className="hidden sm:block" />
            <span className="sm:hidden"> · </span>
            {filtered ? "Filtered view" : "Showing all review records"}
          </span>
        }
        filters={
          <ReviewFilterBar
            state={state}
            domain={domain}
            subcategories={options.reviews.subcategories}
            brands={options.reviews.brands}
            productName={productName}
          />
        }
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <PendingFrame>
          <div className="space-y-6">
            {kpis.ok ? <ReviewKpiBand kpis={kpis.value} /> : <SectionError message={kpis.error} />}

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="min-w-0 xl:col-span-2">
                {trend.ok ? <ReviewActivityCard points={trend.value.points} /> : <SectionError message={trend.error} />}
              </div>
              {ratings.ok ? <RatingDistributionCard data={ratings.value} /> : <SectionError message={ratings.error} />}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Reviews by brand"
                subtitle="Top 10 brands by review records · select a brand to filter the page"
                scope="reviews"
              >
                {!brands.ok ? (
                  <SectionError message={brands.error} />
                ) : brands.value.items.length === 0 ? (
                  <EmptyState />
                ) : (
                  <RankedBarList
                    ariaLabel="Reviews by brand"
                    items={brands.value.items.map((b) => ({
                      key: b.brand_name,
                      label: b.brand_name,
                      sublabel: plural(b.reviewed_products, "product"),
                      value: b.review_count,
                      display: formatInteger(b.review_count),
                      secondary: `★ ${formatRating(b.average_rating)}`,
                      href: state.brand === b.brand_name ? undefined : reviewHref(state, { brand: b.brand_name }),
                      hrefLabel: `Filter reviews to ${b.brand_name}`,
                    }))}
                  />
                )}
              </ChartCard>

              <ChartCard
                title={`Reviews by ${options.reviews.scope_category} subcategory`}
                subtitle="Review records and average rating · select a subcategory to filter the page"
                scope="reviews"
              >
                {!subcats.ok ? (
                  <SectionError message={subcats.error} />
                ) : subcats.value.items.length === 0 ? (
                  <EmptyState />
                ) : (
                  <RankedBarList
                    ariaLabel={`Reviews by ${options.reviews.scope_category} subcategory`}
                    items={subcats.value.items.map((c) => ({
                      key: c.subcategory,
                      label: c.subcategory,
                      sublabel: plural(c.reviewed_products, "product"),
                      value: c.review_count,
                      display: formatInteger(c.review_count),
                      secondary: `★ ${formatRating(c.average_rating)}`,
                      href:
                        state.subcategory === c.subcategory
                          ? undefined
                          : reviewHref(state, { subcategory: c.subcategory }),
                      hrefLabel: `Filter reviews to ${c.subcategory}`,
                    }))}
                  />
                )}
              </ChartCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-5">
              <div className="min-w-0 xl:col-span-3">
                {topProducts.ok ? (
                  <TopReviewedProducts items={topProducts.value} state={state} />
                ) : (
                  <SectionError message={topProducts.error} />
                )}
              </div>
              <div className="min-w-0 xl:col-span-2">
                {profiles.ok ? <ReviewerProfilesCard data={profiles.value} /> : <SectionError message={profiles.error} />}
              </div>
            </div>

            <section
              aria-labelledby="review-explorer-heading"
              className="rounded-xl border border-line bg-white p-5 sm:p-6"
            >
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <ScopeTag scope="reviews" />
                  <h2 id="review-explorer-heading" className="mt-2 text-[15px] font-semibold text-charcoal">
                    Review explorer
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {table.ok
                      ? `${formatInteger(table.value.total)} ${table.value.total === 1 ? "review" : "reviews"} match`
                      : "Search, sort and page through the review records"}
                    {state.q ? ` “${state.q}”` : ""}. The search applies to this table only.
                  </p>
                </div>
                <p className="max-w-md text-xs text-ink-3">
                  Review text is shown as written by customers. Reviewer identifiers are never displayed.
                </p>
              </div>
              {table.ok ? <ReviewTable reviews={table.value} state={state} /> : <SectionError message={table.error} />}
            </section>
          </div>
        </PendingFrame>
      </main>
    </>
  );
}
