import Link from "next/link";
import type { ComparedProduct } from "@/lib/api/types";
import { formatCompact, formatDate, formatInteger, formatPercent, formatRating, formatUsd } from "@/lib/format";
import { compareColors } from "@/lib/theme";

type Better = "high" | "low";

interface Metric {
  key: string;
  label: string;
  title?: string;
  value: (p: ComparedProduct) => number | null;
  format: (n: number) => string;
  /** Which end is marked when one product clearly leads; omitted for neutral facts. */
  better?: Better;
}

const METRICS: Metric[] = [
  { key: "price", label: "Price", value: (p) => p.price_usd, format: formatUsd, better: "low" },
  {
    key: "records",
    label: "Review records",
    title: "Rows in the review dataset (Skincare only)",
    value: (p) => p.review_stats.review_record_count,
    format: formatInteger,
    better: "high",
  },
  {
    key: "avg",
    label: "Average rating",
    title: "Mean rating of the review records",
    value: (p) => p.review_stats.average_rating,
    format: formatRating,
    better: "high",
  },
  { key: "five", label: "Five-star share", value: (p) => p.review_stats.five_star_share, format: formatPercent, better: "high" },
  {
    key: "rec",
    label: "Recommend rate",
    value: (p) => p.review_stats.recommendation_rate,
    format: formatPercent,
    better: "high",
  },
  { key: "loves", label: "Loves", title: "Sephora 'loves' (popularity)", value: (p) => p.loves_count, format: formatCompact, better: "high" },
  {
    key: "catalogue_rating",
    label: "Catalogue rating",
    title: "Sephora's own catalogue rating",
    value: (p) => p.catalogue_rating,
    format: formatRating,
  },
  {
    key: "sephora_reviews",
    label: "Sephora-listed reviews",
    title: "Sephora's catalogue review count — not the review records",
    value: (p) => p.sephora_review_count,
    format: formatInteger,
  },
];

/** Index of the single leading product, or -1 when fewer than two values exist or the lead is tied. */
export function leaderIndex(values: (number | null)[], better: Better): number {
  const present = values.map((v, i) => [v, i] as const).filter(([v]) => v !== null) as [number, number][];
  if (present.length < 2) return -1;
  const target = better === "high" ? Math.max(...present.map(([v]) => v)) : Math.min(...present.map(([v]) => v));
  const winners = present.filter(([v]) => v === target);
  return winners.length === 1 ? winners[0][1] : -1;
}

export function CompareCards({ items }: { items: ComparedProduct[] }) {
  const cols = ["", "", "md:grid-cols-2", "md:grid-cols-3", "md:grid-cols-2 xl:grid-cols-4"][items.length];
  const leaders = Object.fromEntries(
    METRICS.filter((m) => m.better).map((m) => [m.key, leaderIndex(items.map(m.value), m.better!)]),
  );

  return (
    <section aria-label="Side-by-side comparison" className={`grid gap-4 ${cols}`}>
      {items.map((p, i) => {
        const s = p.review_stats;
        return (
          <article key={p.product_id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-white">
            <div aria-hidden className="h-1.5" style={{ background: compareColors[i] }} />
            <div className="flex flex-1 flex-col p-5">
              <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-3">
                Product {i + 1} · {p.brand_name}
              </p>
              <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-charcoal">
                <Link href={`/products/${encodeURIComponent(p.product_id)}`} className="hover:text-burgundy hover:underline">
                  {p.product_name}
                </Link>
              </h3>
              <p className="mt-1 text-xs text-ink-3">
                {[p.primary_category, p.secondary_category, p.size].filter(Boolean).join(" · ")}
              </p>

              <dl className="mt-4 divide-y divide-line text-sm">
                {METRICS.map((m) => {
                  const v = m.value(p);
                  const leads = leaders[m.key] === i;
                  return (
                    <div key={m.key} className="flex items-baseline justify-between gap-3 py-2">
                      <dt className="text-ink-2" title={m.title}>
                        {m.label}
                      </dt>
                      <dd className="flex items-baseline gap-1.5 tabular-nums">
                        {leads && (
                          <span className="rounded-full bg-soft-pink px-1.5 py-px text-[10px] font-medium text-burgundy">
                            {m.better === "low" ? "Lowest" : "Highest"}
                          </span>
                        )}
                        <span className={leads ? "font-semibold text-charcoal" : "text-charcoal"}>
                          {v === null ? "—" : m.format(v)}
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>

              <p className="mt-auto pt-4 text-[11px] text-ink-3">
                {s.review_record_count
                  ? `Reviews ${formatDate(s.first_review_date)} – ${formatDate(s.last_review_date)}`
                  : p.primary_category === "Skincare"
                    ? "No review records for this product."
                    : "Outside Skincare: the review dataset does not cover this product."}
              </p>
            </div>
          </article>
        );
      })}
    </section>
  );
}
