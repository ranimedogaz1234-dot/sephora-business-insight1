import type { ExecutiveKpis } from "@/lib/api/types";
import { formatCompact, formatInteger, formatMonthYear, formatPercent, formatRating, plural } from "@/lib/format";
import { ScopeTag } from "@/components/ui/ScopeTag";
import { StatTile } from "@/components/ui/StatTile";

const pct = (v: number | null) => (v === null ? "—" : formatPercent(v));

/** Review KPI cards. Every figure is computed from the filtered review records. */
export function ReviewKpiBand({ kpis }: { kpis: ExecutiveKpis }) {
  const r = kpis.reviews;
  const dq = kpis.data_quality;
  const empty = r.review_count === 0;

  const tiles = [
    { label: "Average rating", value: r.average_rating === null ? "—" : formatRating(r.average_rating), unit: "/ 5" },
    { label: "Five-star share", value: pct(r.five_star_share) },
    {
      label: "Recommend rate",
      value: pct(r.recommendation_rate),
      note: `of ${formatCompact(r.recommendation_responses)} who answered`,
    },
    { label: "Unique reviewers", value: formatCompact(r.unique_reviewers) },
    { label: "Reviewed products", value: formatInteger(r.reviewed_products) },
    { label: "Reviewed brands", value: formatInteger(r.reviewed_brands) },
  ];

  return (
    <section aria-labelledby="review-kpi-heading" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)]">
      <h2 id="review-kpi-heading" className="sr-only">
        Review statistics
      </h2>
      <div className="flex flex-col justify-between rounded-xl border border-line bg-white p-6">
        <ScopeTag scope="reviews" />
        <div className="mt-5">
          <StatTile
            size="hero"
            label={kpis.filters_applied ? "Reviews in selection" : "Review records"}
            value={formatInteger(r.review_count)}
            note={
              empty
                ? "No reviews match the current filters."
                : `${formatMonthYear(r.first_review_date)} – ${formatMonthYear(r.last_review_date)}`
            }
          />
        </div>
        <p className="mt-5 border-t border-line pt-4 text-xs text-ink-3">
          {kpis.filters_applied
            ? `${formatPercent(dq.review_records_total ? r.review_count / dq.review_records_total : 0)} of ${formatInteger(
                dq.review_records_total,
              )} review records.`
            : `Deduplicated: ${plural(dq.duplicate_reviews_removed, "exact duplicate copy", "exact duplicate copies")} removed.`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white p-5">
            <StatTile label={t.label} value={t.value} unit={t.unit} note={t.note} />
          </div>
        ))}
      </div>
    </section>
  );
}
