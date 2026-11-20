import Link from "next/link";
import { X } from "lucide-react";
import type {
  BrandItem,
  CatalogueCategories,
  ExecutiveKpis,
  RankedProduct,
  ReviewCategories,
} from "@/lib/api/types";
import type { Settled } from "@/lib/settle";
import { formatCompact, formatInteger, formatPercent, formatRating, formatUsd, plural } from "@/lib/format";
import { brandHref, type BrandPageState } from "@/lib/brandFilters";
import { RankedBarList } from "@/components/charts/RankedBarList";
import { ScopeTag } from "@/components/ui/ScopeTag";
import { StatTile } from "@/components/ui/StatTile";
import { EmptyState, SectionError } from "@/components/ui/States";

/** Rating and recommendation gaps within these bounds read as "in line" (same rule as product insights). */
const RATING_TOLERANCE = 0.1;
const MIN_COMPARISON_REVIEWS = 30;

interface BrandFocusProps {
  state: BrandPageState;
  brand: BrandItem;
  kpis: Settled<ExecutiveKpis>;
  categoryMix: Settled<CatalogueCategories>;
  brandSubcats: Settled<ReviewCategories>;
  allSubcats: Settled<ReviewCategories>;
  topProducts: Settled<RankedProduct[]>;
}

function Delta({ value, brand, all }: { value: string; brand: number; all: number }) {
  const diff = brand - all;
  const tone = Math.abs(diff) <= RATING_TOLERANCE ? "text-ink-3" : diff > 0 ? "text-burgundy" : "text-charcoal";
  return (
    <span className={`tabular-nums ${tone}`}>
      {value}
      <span className="sr-only">{diff > 0 ? " above" : diff < 0 ? " below" : ""} all brands</span>
    </span>
  );
}

/** Drill-down panel for one brand: catalogue footprint, review figures and subcategory comparison. */
export function BrandFocus({ state, brand, kpis, categoryMix, brandSubcats, allSubcats, topProducts }: BrandFocusProps) {
  const reviewQuery = new URLSearchParams({ brand: brand.brand_name });
  if (state.subcategory) reviewQuery.set("subcategory", state.subcategory);
  const allBySub = allSubcats.ok ? new Map(allSubcats.value.items.map((c) => [c.subcategory, c])) : new Map();
  const r = kpis.ok ? kpis.value.reviews : null;

  return (
    <section
      id="brand-focus"
      aria-labelledby="brand-focus-heading"
      className="scroll-mt-48 rounded-xl border border-elegant-pink/70 bg-white p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-burgundy">Brand focus</p>
          <h2 id="brand-focus-heading" className="mt-1 font-display text-2xl text-charcoal">
            {brand.brand_name}
          </h2>
          <p className="mt-1 text-xs text-ink-3">
            {plural(brand.product_count, "product")} in {plural(brand.category_count, "catalogue category", "catalogue categories")}
            {state.subcategory ? ` · review figures limited to ${state.subcategory}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href={`/reviews?${reviewQuery.toString()}`}
            className="rounded-md border border-line px-3 py-1.5 text-charcoal transition-colors hover:border-burgundy hover:text-burgundy"
          >
            Review analytics
          </Link>
          <Link
            href={`/products?${new URLSearchParams({ brand: brand.brand_name }).toString()}`}
            className="rounded-md border border-line px-3 py-1.5 text-charcoal transition-colors hover:border-burgundy hover:text-burgundy"
          >
            Products
          </Link>
          <Link
            href={brandHref(state, { brand: undefined })}
            scroll={false}
            aria-label="Close brand focus"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-3 transition-colors hover:bg-light-gray hover:text-charcoal"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-5 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Products", value: formatInteger(brand.product_count), scope: "Catalogue" },
          { label: "Average price", value: formatUsd(brand.average_price_usd), scope: "Catalogue" },
          { label: "Loves", value: formatCompact(brand.loves_count), scope: "Catalogue" },
          { label: "Review records", value: r ? formatInteger(r.review_count) : "—", scope: "Reviews" },
          {
            label: "Average rating",
            value: r?.average_rating == null ? "—" : formatRating(r.average_rating),
            scope: "Reviews",
          },
          {
            label: "Recommend rate",
            value: r?.recommendation_rate == null ? "—" : formatPercent(r.recommendation_rate),
            scope: "Reviews",
          },
        ].map((t) => (
          <div key={t.label}>
            <StatTile size="compact" label={t.label} value={t.value} note={t.scope} />
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="min-w-0">
          <ScopeTag scope="catalogue" />
          <h3 className="mt-2 text-sm font-semibold text-charcoal">Catalogue by category</h3>
          <div className="mt-4">
            {!categoryMix.ok ? (
              <SectionError message={categoryMix.error} />
            ) : (
              <RankedBarList
                ariaLabel={`${brand.brand_name} products by category`}
                ranked={false}
                items={categoryMix.value.items.map((c) => ({
                  key: c.category,
                  label: c.category,
                  value: c.product_count,
                  display: formatInteger(c.product_count),
                  secondary: formatPercent(c.share_of_products),
                }))}
              />
            )}
          </div>
        </div>

        <div className="min-w-0">
          <ScopeTag scope="reviews" />
          <h3 className="mt-2 text-sm font-semibold text-charcoal">Most reviewed products</h3>
          <div className="mt-4">
            {!topProducts.ok ? (
              <SectionError message={topProducts.error} />
            ) : topProducts.value.length === 0 ? (
              <EmptyState message="This brand has no review records in the current selection. The review dataset covers Skincare only." />
            ) : (
              <ol className="divide-y divide-line text-sm">
                {topProducts.value.map((p) => (
                  <li key={p.product_id} className="flex items-baseline justify-between gap-3 py-2">
                    <Link
                      href={`/products/${encodeURIComponent(p.product_id)}`}
                      className="min-w-0 truncate text-charcoal hover:text-burgundy hover:underline"
                      title={p.product_name}
                    >
                      {p.product_name}
                    </Link>
                    <span className="shrink-0 tabular-nums text-ink-3">
                      {formatInteger(p.review_count)} · ★ {formatRating(p.average_rating)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <ScopeTag scope="reviews" />
        <h3 className="mt-2 text-sm font-semibold text-charcoal">Brand versus all brands, by Skincare subcategory</h3>
        <p className="mt-0.5 text-xs text-ink-3">
          Same filters for both columns. Differences within ±{RATING_TOLERANCE.toFixed(2)} stars are shown in grey;
          comparisons need at least {MIN_COMPARISON_REVIEWS} brand reviews in the subcategory.
        </p>
        <div className="mt-4">
          {!brandSubcats.ok ? (
            <SectionError message={brandSubcats.error} />
          ) : brandSubcats.value.items.length === 0 ? (
            <EmptyState message="No review records for this brand in the current selection." />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <caption className="sr-only">{brand.brand_name} compared with all brands by Skincare subcategory</caption>
                <thead className="border-b border-line text-[11px] font-medium uppercase tracking-wide text-ink-3">
                  <tr>
                    <th scope="col" className="py-2 pr-3 font-medium">Subcategory</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Brand reviews</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Brand rating</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">All brands rating</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Brand recommend</th>
                    <th scope="col" className="py-2 pl-3 text-right font-medium">All brands recommend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {brandSubcats.value.items.map((c) => {
                    const all = allBySub.get(c.subcategory);
                    const comparable = !!all && c.review_count >= MIN_COMPARISON_REVIEWS;
                    return (
                      <tr key={c.subcategory}>
                        <td className="py-2.5 pr-3 text-charcoal">{c.subcategory}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{formatInteger(c.review_count)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {comparable ? (
                            <Delta value={formatRating(c.average_rating)} brand={c.average_rating} all={all.average_rating} />
                          ) : (
                            <span className="tabular-nums text-ink-2">{formatRating(c.average_rating)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink-3">
                          {all ? formatRating(all.average_rating) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">
                          {c.recommendation_rate === null ? "—" : formatPercent(c.recommendation_rate)}
                        </td>
                        <td className="py-2.5 pl-3 text-right tabular-nums text-ink-3">
                          {all?.recommendation_rate == null ? "—" : formatPercent(all.recommendation_rate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
