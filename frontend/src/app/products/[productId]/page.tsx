import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { ApiError, api } from "@/lib/api/client";
import type { ProductDetail } from "@/lib/api/types";
import { aggregateTrend } from "@/lib/aggregate";
import type { RawSearchParams } from "@/lib/filters";
import { formatDate, formatInteger, formatPercent, formatRating, formatUsd, plural } from "@/lib/format";
import { productInsights } from "@/lib/insights";
import { parseReviewListState, toReviewApiParams } from "@/lib/reviewListState";
import { settle } from "@/lib/settle";
import { PageHeader } from "@/components/layout/PageHeader";
import { PendingFrame } from "@/components/layout/NavigationTransition";
import { RatingDistributionCard } from "@/components/charts/RatingDistributionCard";
import { ReviewActivityCard } from "@/components/charts/ReviewActivityCard";
import { InsightList } from "@/components/products/InsightList";
import { ProductReviewList } from "@/components/products/ProductReviewList";
import { ProductFlags } from "@/components/products/ProductTable";
import { ApiUnavailable } from "@/components/ui/ApiUnavailable";
import { ScopeTag } from "@/components/ui/ScopeTag";
import { StatTile } from "@/components/ui/StatTile";
import { SectionError } from "@/components/ui/States";

const PRODUCT_ID = /^P\d{1,12}$/;

/** One product request per render, shared by generateMetadata and the page. */
const getProduct = cache((id: string) => api.product(id));

type Props = { params: Promise<{ productId: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { productId } = await params;
  if (!PRODUCT_ID.test(productId)) return { title: "Product not found · Sephora Business Insight" };
  try {
    const p = await getProduct(productId);
    return { title: `${p.product_name} · ${p.brand_name} · Sephora Business Insight` };
  } catch {
    return { title: "Product · Sephora Business Insight" };
  }
}

function Card({ title, scope, children }: { title: string; scope?: "reviews" | "catalogue"; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-white p-5 sm:p-6">
      {scope && <ScopeTag scope={scope} />}
      <h2 className={`${scope ? "mt-2" : ""} text-[15px] font-semibold text-charcoal`}>{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-t border-line py-2 first:border-t-0 first:pt-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="text-right text-sm text-charcoal">{children}</dd>
    </div>
  );
}

function CatalogueFacts({ p }: { p: ProductDetail }) {
  return (
    <Card title="Product information" scope="catalogue">
      <dl>
        <Fact label="Price">
          {formatUsd(p.price_usd)}
          {p.sale_price_usd !== null && <span className="ml-2 text-burgundy">Sale {formatUsd(p.sale_price_usd)}</span>}
        </Fact>
        {p.value_price_usd !== null && <Fact label="Value price">{formatUsd(p.value_price_usd)}</Fact>}
        {p.size && <Fact label="Size">{p.size}</Fact>}
        {p.variation_type && (
          <Fact label={p.variation_type}>{p.variation_value ?? "—"}</Fact>
        )}
        {p.child_count > 0 && <Fact label="Variants">{formatInteger(p.child_count)}</Fact>}
        <Fact label="Catalogue rating">
          {p.catalogue_rating === null ? "—" : `★ ${formatRating(p.catalogue_rating)}`}
        </Fact>
        <Fact label="Sephora-listed reviews">
          {p.sephora_review_count === null ? "—" : formatInteger(p.sephora_review_count)}
        </Fact>
        <Fact label="Loves">{formatInteger(p.loves_count)}</Fact>
      </dl>
      <ProductFlags product={p} />

      {p.highlights.length > 0 && (
        <div className="mt-5">
          <h3 className="text-xs font-medium text-ink-2">Highlights</h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {p.highlights.map((h) => (
              <li key={h} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-ink-2">
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.ingredients.length > 0 && (
        <details className="group mt-5">
          <summary className="cursor-pointer text-xs font-medium text-burgundy hover:underline">
            Ingredients as listed in the catalogue
          </summary>
          <div className="mt-2 max-h-60 space-y-2 overflow-auto text-xs leading-relaxed text-ink-2">
            {p.ingredients.map((text, i) => (
              <p key={i} className="break-words">
                {text}
              </p>
            ))}
          </div>
        </details>
      )}
    </Card>
  );
}

export default async function ProductPage({ params, searchParams }: Props) {
  await connection();
  const { productId } = await params;
  if (!PRODUCT_ID.test(productId)) notFound();

  let product: ProductDetail;
  try {
    product = await getProduct(productId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    return (
      <ApiUnavailable eyebrow="Product analytics" title="Product details" description="Product details." error={e} />
    );
  }

  const stats = product.review_stats;
  const hasRecords = stats.review_record_count > 0;
  const reviewState = parseReviewListState(await searchParams);
  const subcategory = product.secondary_category;

  const [trend, reviews, peers, priceGroups] = await Promise.all([
    hasRecords ? settle(api.trend({ product_id: [productId] }, "month")) : null,
    hasRecords ? settle(api.reviews(toReviewApiParams(productId, reviewState))) : null,
    hasRecords && subcategory ? settle(api.reviewCategories({ subcategory: [subcategory] })) : null,
    subcategory ? settle(api.catalogueCategories(product.primary_category)) : null,
  ]);

  const insights = productInsights({
    product,
    subcategory: peers?.ok ? (peers.value.items.find((c) => c.subcategory === subcategory) ?? null) : null,
    priceGroup: priceGroups?.ok ? (priceGroups.value.items.find((c) => c.category === subcategory) ?? null) : null,
    yearly: trend?.ok ? aggregateTrend(trend.value.points, "year") : [],
  });

  const path = [product.primary_category, product.secondary_category, product.tertiary_category].filter(Boolean);

  return (
    <>
      <PageHeader
        eyebrow={product.brand_name}
        title={product.product_name}
        description={path.join(" › ")}
        meta={
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-burgundy hover:underline"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
            All products
          </Link>
        }
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <PendingFrame>
          <div className="space-y-6">
            {hasRecords ? (
              <section
                aria-label="Review record summary"
                className="grid grid-cols-2 gap-x-6 gap-y-6 rounded-xl border border-line bg-white p-5 sm:p-6 lg:grid-cols-5"
              >
                <div className="col-span-2 lg:col-span-1">
                  <ScopeTag scope="reviews" />
                  <div className="mt-3">
                    <StatTile
                      label="Total reviews"
                      value={formatInteger(stats.review_record_count)}
                      note={`${formatDate(stats.first_review_date)} – ${formatDate(stats.last_review_date)}`}
                    />
                  </div>
                </div>
                <StatTile
                  label="Average rating"
                  value={stats.average_rating === null ? "—" : formatRating(stats.average_rating)}
                  unit="/ 5"
                />
                <StatTile
                  label="Five-star share"
                  value={stats.five_star_share === null ? "—" : formatPercent(stats.five_star_share)}
                />
                <StatTile
                  label="Would recommend"
                  value={stats.recommendation_rate === null ? "—" : formatPercent(stats.recommendation_rate)}
                  note="Among reviewers who answered"
                />
                <StatTile
                  label="Sephora-listed reviews"
                  value={product.sephora_review_count === null ? "—" : formatInteger(product.sephora_review_count)}
                  note="Catalogue figure, not review records"
                />
              </section>
            ) : (
              <section role="note" className="rounded-xl border border-line bg-light-gray p-5 text-sm text-ink-2 sm:p-6">
                <p className="font-medium text-charcoal">No review records for this product</p>
                <p className="mt-1">
                  The review dataset covers Skincare products only
                  {product.primary_category !== "Skincare" ? ` and this product is in ${product.primary_category}` : ""}.
                  Sephora&apos;s catalogue lists{" "}
                  {product.sephora_review_count === null
                    ? "no review count"
                    : plural(product.sephora_review_count, "review")}
                  {product.catalogue_rating !== null ? ` with a ${formatRating(product.catalogue_rating)} rating` : ""}.
                </p>
              </section>
            )}

            <div className="grid gap-6 xl:grid-cols-3">
              <div className="min-w-0 space-y-6 xl:col-span-2">
                {hasRecords && (
                  <div className="grid gap-6 lg:grid-cols-2">
                    <RatingDistributionCard
                      data={{
                        total: stats.review_record_count,
                        average_rating: stats.average_rating,
                        buckets: stats.rating_distribution,
                      }}
                    />
                    <Card title="Insights" scope="reviews">
                      <InsightList insights={insights} />
                      <p className="mt-5 text-[11px] text-ink-3">
                        Computed from review records and catalogue figures; compared with the same Skincare
                        subcategory and catalogue category.
                      </p>
                    </Card>
                  </div>
                )}
                {trend &&
                  (trend.ok ? <ReviewActivityCard points={trend.value.points} /> : <SectionError message={trend.error} />)}
                {reviews && (
                  <Card title="Customer reviews" scope="reviews">
                    {reviews.ok ? (
                      <ProductReviewList reviews={reviews.value} state={reviewState} />
                    ) : (
                      <SectionError message={reviews.error} />
                    )}
                  </Card>
                )}
                {!hasRecords && insights.length > 0 && (
                  <Card title="Insights" scope="catalogue">
                    <InsightList insights={insights} />
                  </Card>
                )}
              </div>
              <div className="min-w-0">
                <CatalogueFacts p={product} />
              </div>
            </div>
          </div>
        </PendingFrame>
      </main>
    </>
  );
}
