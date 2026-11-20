import { Sparkles } from "lucide-react";
import type { ComparedProduct, SentimentBreakdown } from "@/lib/api/types";
import { formatInteger, formatPercent } from "@/lib/format";
import { compareColors } from "@/lib/theme";
import { SentimentBar, SentimentLegend } from "@/components/sentiment/SentimentBar";

/** Per-product sentiment for the compared products, only where labels exist. */
export function CompareSentiment({ items, data }: { items: ComparedProduct[]; data: SentimentBreakdown | null }) {
  const byId = new Map((data?.items ?? []).map((g) => [g.key, g]));
  const any = byId.size > 0;
  return (
    <section aria-labelledby="sentiment-compare-heading" className="flex flex-col rounded-xl border border-line bg-white p-5 sm:p-6">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-burgundy">AI sentiment</p>
      <h2 id="sentiment-compare-heading" className="mt-2 text-[15px] font-semibold text-charcoal">
        Sentiment comparison
      </h2>
      {!any ? (
        <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-2 rounded-lg bg-light-gray px-6 py-10 text-center">
          <Sparkles aria-hidden className="h-5 w-5 text-ink-3" strokeWidth={1.75} />
          <p className="text-sm text-ink-2">No sentiment results for these products yet.</p>
          <p className="max-w-sm text-xs text-ink-3">
            They appear here once AI sentiment analysis has classified these products&apos; reviews. Nothing is estimated
            in the meantime.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-0.5 text-xs text-ink-3">Share of each product&apos;s classified reviews</p>
          <div className="mt-4">
            <SentimentLegend />
          </div>
          <ul className="mt-4 space-y-4">
            {items.map((p, i) => {
              const g = byId.get(p.product_id);
              return (
                <li key={p.product_id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="inline-flex min-w-0 items-center gap-2 text-sm text-charcoal">
                      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: compareColors[i] }} />
                      <span className="truncate" title={p.product_name}>
                        {p.product_name}
                      </span>
                    </p>
                    <span className="shrink-0 text-xs tabular-nums text-ink-3">
                      {g
                        ? `${formatPercent(g.positive_share)} positive · ${formatPercent(g.negative_share)} negative · ${formatInteger(g.classified)} of ${formatInteger(p.review_stats.review_record_count)} classified`
                        : p.review_stats.review_record_count
                          ? "Not classified yet"
                          : "No review records"}
                    </span>
                  </div>
                  {g && (
                    <div className="mt-2">
                      <SentimentBar shares={{ positive: g.positive_share, neutral: g.neutral_share, negative: g.negative_share }} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
