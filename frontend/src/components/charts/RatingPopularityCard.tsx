"use client";

import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { PopularityPoint, RatingPopularity } from "@/lib/api/types";
import { formatCompact, formatInteger, formatRating, formatUsd } from "@/lib/format";
import { chartChrome, colors } from "@/lib/theme";
import { ChartCard } from "@/components/ui/ChartCard";
import { EmptyState } from "@/components/ui/States";
import { ChartTooltip } from "./ChartTooltip";

function PointTooltip({ active, payload }: { active?: boolean; payload?: { payload: PopularityPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <ChartTooltip
      title={`${p.product_name} · ${p.brand_name}`}
      rows={[
        { label: "Average rating", value: formatRating(p.average_rating) },
        { label: "Reviews", value: formatInteger(p.review_count) },
        { label: "Loves", value: formatCompact(p.loves_count) },
        { label: "Price", value: formatUsd(p.price_usd) },
      ]}
    />
  );
}

/** 8px dot with a 2px surface ring, inside a transparent 24px hit area. */
function Dot(props: { cx?: number; cy?: number }) {
  const { cx = 0, cy = 0 } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill="transparent" />
      <circle cx={cx} cy={cy} r={4} fill={colors.burgundy} fillOpacity={0.55} stroke={colors.white} strokeWidth={1.5} />
    </g>
  );
}

export function RatingPopularityCard({ data, minReviews }: { data: RatingPopularity; minReviews: number }) {
  const points = data.points;
  const maxReviews = Math.max(minReviews, ...points.map((p) => p.review_count));
  // Explicit 1-2.5-5 ticks on the log axis (auto log ticks crowd together); one compact style.
  const xTicks = [10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000].filter(
    (t) => t >= minReviews && t <= maxReviews * 1.05,
  );
  const top = [...points].sort((a, b) => b.review_count - a.review_count).slice(0, 100);
  return (
    <ChartCard
      title="Ratings versus popularity"
      subtitle={`Each dot is one of the ${formatInteger(data.total_products)} products with at least ${minReviews} reviews${
        data.returned < data.total_products ? ` (most reviewed ${formatInteger(data.returned)} shown)` : ""
      }. Review volume uses a log scale.`}
      scope="reviews"
      table={{
        columns: [
          { key: "product", label: "Product" },
          { key: "brand", label: "Brand" },
          { key: "reviews", label: "Reviews", align: "right" },
          { key: "rating", label: "Avg rating", align: "right" },
          { key: "loves", label: "Loves", align: "right" },
        ],
        rows: top.map((p) => ({
          product: p.product_name,
          brand: p.brand_name,
          reviews: formatInteger(p.review_count),
          rating: formatRating(p.average_rating),
          loves: formatInteger(p.loves_count),
        })),
      }}
      footnote={
        data.returned > 0
          ? "Table view lists the 100 most reviewed products in the current selection."
          : undefined
      }
    >
      {points.length === 0 ? (
        <EmptyState message={`No product has at least ${minReviews} reviews in the current selection.`} />
      ) : (
        <div className="h-[340px]" role="img" aria-label="Scatter plot of average rating against number of reviews per product">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="" />
              <XAxis
                type="number"
                dataKey="review_count"
                name="Reviews"
                scale="log"
                domain={[minReviews, Math.ceil(maxReviews * 1.05)]}
                ticks={xTicks}
                allowDataOverflow
                tickFormatter={(n: number) => formatCompact(n)}
                tick={chartChrome.tick}
                axisLine={false}
                tickLine={false}
                label={{ value: "Reviews (log scale)", position: "insideBottom", offset: -12, fill: colors.ink3, fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="average_rating"
                name="Average rating"
                domain={[1, 5]}
                ticks={[1, 2, 3, 4, 5]}
                tick={chartChrome.tick}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<PointTooltip />} cursor={false} isAnimationActive={false} />
              <Scatter data={points} shape={<Dot />} isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
