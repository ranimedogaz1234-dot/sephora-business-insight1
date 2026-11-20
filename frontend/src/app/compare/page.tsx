import type { Metadata } from "next";
import { connection } from "next/server";
import { GitCompareArrows, Sparkles } from "lucide-react";
import { ApiError, api } from "@/lib/api/client";
import type { Page, ProductComparison, ProductItem } from "@/lib/api/types";
import { MAX_COMPARE, MIN_COMPARE, canCompare, parseCompareState, FINDER_PAGE_SIZE } from "@/lib/compareState";
import type { RawSearchParams } from "@/lib/filters";
import { settle, type Settled } from "@/lib/settle";
import { PageHeader } from "@/components/layout/PageHeader";
import { PendingFrame } from "@/components/layout/NavigationTransition";
import { CompareCards } from "@/components/compare/CompareCards";
import { ActivityCompare, PopularityCompare, RatingMixCompare } from "@/components/compare/CompareCharts";
import { ComparePicker, type SelectedProduct } from "@/components/compare/ComparePicker";
import { SectionError } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Product Comparison · Sephora Business Insight",
  description: "Compare two to four Sephora products side by side.",
};

const HEADER = {
  eyebrow: "Product comparison",
  title: "Compare products side by side",
  description:
    "Choose two to four products to compare price, ratings, review volume, rating mix, review activity and popularity.",
};

const pick = (p: SelectedProduct): SelectedProduct => ({
  product_id: p.product_id,
  product_name: p.product_name,
  brand_name: p.brand_name,
});

/**
 * Resolve the selected IDs. An unknown ID (API 404) is dropped rather than failing the
 * page; other errors are shown in place of the comparison.
 */
async function resolve(ids: string[], grain: "year" | "quarter") {
  let comparison: Settled<ProductComparison> | null = null;
  let selected: SelectedProduct[] = [];
  let kept = ids;

  if (ids.length >= MIN_COMPARE) {
    try {
      const value = await api.compareProducts(ids, grain);
      return { ids, selected: value.items.map(pick), comparison: { ok: true as const, value } };
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) {
        return {
          ids,
          selected: ids.map((id) => ({ product_id: id, product_name: id, brand_name: "" })),
          comparison: { ok: false as const, error: e instanceof Error ? e.message : String(e) },
        };
      }
    }
  }

  const found = await Promise.all(ids.map((id) => settle(api.product(id))));
  selected = found.flatMap((r) => (r.ok ? [pick(r.value)] : []));
  kept = selected.map((p) => p.product_id);
  if (kept.length >= MIN_COMPARE) comparison = await settle(api.compareProducts(kept, grain));
  return { ids: kept, selected, comparison };
}

export default async function ProductComparisonPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await connection();

  const parsed = parseCompareState(await searchParams);
  const [resolved, finder] = await Promise.all([
    resolve(parsed.ids, parsed.grain),
    parsed.find
      ? settle(
          api.products({
            q: parsed.find,
            sort_by: "review_record_count",
            order: "desc",
            page_size: FINDER_PAGE_SIZE,
          }),
        )
      : Promise.resolve(null),
  ]);
  const state = { ...parsed, ids: resolved.ids };
  const comparison = resolved.comparison;
  const results: Page<ProductItem> | null = finder?.ok ? finder.value : null;

  return (
    <>
      <PageHeader
        {...HEADER}
        meta={<span>Compare up to {MAX_COMPARE} products from any category</span>}
        filters={
          <ComparePicker
            state={state}
            selected={resolved.selected}
            results={results}
            resultsError={finder && !finder.ok ? finder.error : undefined}
          />
        }
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <PendingFrame>
          {!canCompare(state) ? (
            <section className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line-strong bg-white px-6 py-16 text-center">
              <GitCompareArrows aria-hidden className="h-6 w-6 text-burgundy" strokeWidth={1.75} />
              <h2 className="text-[15px] font-semibold text-charcoal">
                {state.ids.length === 1 ? "Add one more product to compare" : "Choose products to compare"}
              </h2>
              <p className="max-w-md text-sm text-ink-2">
                Search above and add two to four products. You can also start from any product page with
                &ldquo;Compare&rdquo;. The comparison is kept in the address, so it can be shared.
              </p>
            </section>
          ) : !comparison?.ok ? (
            <SectionError message={comparison?.error ?? "The comparison could not be loaded."} />
          ) : (
            <div className="space-y-6">
              <CompareCards items={comparison.value.items} />

              <div className="grid gap-6 xl:grid-cols-2">
                <RatingMixCompare items={comparison.value.items} />
                <ActivityCompare data={comparison.value} state={state} />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <PopularityCompare items={comparison.value.items} />
                <section
                  aria-labelledby="sentiment-compare-heading"
                  className="flex flex-col rounded-xl border border-line bg-white p-5 sm:p-6"
                >
                  <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-3">AI sentiment</p>
                  <h2 id="sentiment-compare-heading" className="mt-2 text-[15px] font-semibold text-charcoal">
                    Sentiment comparison
                  </h2>
                  <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-2 rounded-lg bg-light-gray px-6 py-10 text-center">
                    <Sparkles aria-hidden className="h-5 w-5 text-ink-3" strokeWidth={1.75} />
                    <p className="text-sm text-ink-2">Sentiment results are not available yet.</p>
                    <p className="max-w-sm text-xs text-ink-3">
                      They will appear here once AI sentiment analysis has classified these products&apos; reviews.
                      No sentiment figures are estimated in the meantime.
                    </p>
                  </div>
                </section>
              </div>
            </div>
          )}
        </PendingFrame>
      </main>
    </>
  );
}
