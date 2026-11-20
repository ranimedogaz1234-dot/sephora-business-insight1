"use client";

import { useState } from "react";
import type { ProfileDimensionName, ReviewerProfiles } from "@/lib/api/types";
import { formatInteger, formatPercent, formatRating } from "@/lib/format";
import { RankedBarList } from "@/components/charts/RankedBarList";
import { ChartCard } from "@/components/ui/ChartCard";
import { EmptyState } from "@/components/ui/States";

export const DIMENSION_LABELS: Record<ProfileDimensionName, string> = {
  skin_type: "Skin type",
  skin_tone: "Skin tone",
  eye_color: "Eye color",
  hair_color: "Hair color",
};

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Self-reported reviewer attributes, aggregated. Shares are of reviews that answered;
 * unanswered reviews are stated in the subtitle rather than drawn as a segment.
 */
export function ReviewerProfilesCard({ data }: { data: ReviewerProfiles }) {
  const [dimension, setDimension] = useState<ProfileDimensionName>("skin_type");
  const dim = data.dimensions.find((d) => d.dimension === dimension) ?? data.dimensions[0];
  const label = DIMENSION_LABELS[dim?.dimension ?? "skin_type"];

  const action = (
    <div role="group" aria-label="Reviewer attribute" className="flex flex-wrap rounded-md border border-line p-0.5">
      {data.dimensions.map((d) => (
        <button
          key={d.dimension}
          type="button"
          aria-pressed={d.dimension === dimension}
          onClick={() => setDimension(d.dimension)}
          className={`h-7 rounded px-2.5 text-xs transition-colors ${
            d.dimension === dimension ? "bg-soft-pink font-medium text-burgundy" : "text-ink-3 hover:text-charcoal"
          }`}
        >
          {DIMENSION_LABELS[d.dimension]}
        </button>
      ))}
    </div>
  );

  const segments = dim?.segments ?? [];
  return (
    <ChartCard
      title="Reviewer profiles"
      subtitle={
        dim && dim.answered + dim.missing > 0
          ? `${label} as self-reported by reviewers · ${formatPercent(
              dim.answered / (dim.answered + dim.missing),
            )} answered (${formatInteger(dim.missing)} did not)`
          : "Self-reported reviewer attributes"
      }
      scope="reviews"
      action={action}
      table={{
        columns: [
          { key: "value", label: label },
          { key: "reviews", label: "Reviews", align: "right" },
          { key: "share", label: "Share", align: "right" },
          { key: "rating", label: "Average rating", align: "right" },
          { key: "rec", label: "Recommend rate", align: "right" },
        ],
        rows: segments.map((s) => ({
          value: capitalise(s.value),
          reviews: formatInteger(s.review_count),
          share: formatPercent(s.share),
          rating: formatRating(s.average_rating),
          rec: s.recommendation_rate === null ? "—" : formatPercent(s.recommendation_rate),
        })),
      }}
      footnote="Aggregates only: no individual reviewer is identified or shown."
    >
      {segments.length === 0 ? (
        <EmptyState message={`No reviews in this selection report a ${label.toLowerCase()}.`} />
      ) : (
        <RankedBarList
          ariaLabel={`Reviews by ${label.toLowerCase()}`}
          ranked={false}
          items={segments.map((s) => ({
            key: s.value,
            label: capitalise(s.value),
            value: s.review_count,
            display: formatPercent(s.share),
            secondary: `${formatInteger(s.review_count)} · ★ ${formatRating(s.average_rating)}`,
          }))}
        />
      )}
    </ChartCard>
  );
}
