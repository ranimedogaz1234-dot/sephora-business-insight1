import type { ExecutiveKpis } from "@/lib/api/types";
import {
  formatCompact,
  formatInteger,
  formatMonthYear,
  formatPercent,
  formatRating,
  formatUsd,
  plural,
} from "@/lib/format";
import { ScopeTag } from "@/components/ui/ScopeTag";
import { StatTile } from "@/components/ui/StatTile";

const pct = (v: number | null) => (v === null ? "—" : formatPercent(v));

export function KpiSection({ kpis }: { kpis: ExecutiveKpis }) {
  const r = kpis.reviews;
  const c = kpis.catalogue;
  const dq = kpis.data_quality;
  const empty = r.review_count === 0;

  return (
    <section aria-labelledby="kpi-heading" className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,2fr)]">
      <h2 id="kpi-heading" className="sr-only">
        Key performance indicators
      </h2>

      {/* Hero: the one number the overview leads with */}
      <div className="flex flex-col justify-between rounded-xl border border-line bg-white p-6">
        <ScopeTag scope="reviews" />
        <div className="mt-6">
          <StatTile
            size="hero"
            label={kpis.filters_applied ? "Reviews in selection" : "Total reviews"}
            value={formatInteger(r.review_count)}
            note={
              empty
                ? "No reviews match the current filters."
                : `${formatMonthYear(r.first_review_date)} – ${formatMonthYear(r.last_review_date)} · ${plural(
                    r.reviewed_products,
                    `${kpis.review_scope_category} product`,
                  )} · ${plural(r.reviewed_brands, "brand")}`
            }
          />
        </div>
        <p className="mt-6 border-t border-line pt-4 text-xs text-ink-3">
          {kpis.filters_applied
            ? `${formatInteger(dq.review_records_total)} review records in total.`
            : `${formatInteger(dq.raw_review_count)} raw rows; ${formatInteger(dq.duplicate_reviews_removed)} exact duplicate copies removed.`}
        </p>
      </div>

      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
          {[
            { label: "Average rating", value: r.average_rating === null ? "—" : formatRating(r.average_rating), unit: "/ 5" },
            { label: "Five-star share", value: pct(r.five_star_share) },
            {
              label: "Recommend rate",
              value: pct(r.recommendation_rate),
              note: `of ${formatCompact(r.recommendation_responses)} who answered`,
            },
            { label: "Unique reviewers", value: formatCompact(r.unique_reviewers) },
          ].map((t) => (
            <div key={t.label} className="bg-white p-5">
              <StatTile label={t.label} value={t.value} unit={t.unit} note={t.note} />
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ScopeTag scope="catalogue" />
            <span className="text-[11px] text-ink-3">Not affected by review filters</span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-5">
            {[
              { label: "Products", value: formatInteger(c.total_products) },
              { label: "Brands", value: formatInteger(c.total_brands) },
              { label: "Categories", value: formatInteger(c.total_categories) },
              { label: "Median price", value: formatUsd(c.median_price_usd) },
              {
                label: "Sephora-listed reviews",
                value: formatCompact(c.sephora_review_count),
                title: "Sephora's own catalogue count — not the review records above",
              },
            ].map((t) => (
              <div key={t.label} title={t.title}>
                <dt className="text-xs text-ink-2">{t.label}</dt>
                <dd className="mt-1 text-xl font-semibold tracking-tight text-charcoal">{t.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
