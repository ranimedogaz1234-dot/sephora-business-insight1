"use client";

import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import type { BrandReviewStat, BrandReviewStats } from "@/lib/api/types";
import { formatCompact, formatInteger, formatPercent, formatRating, plural } from "@/lib/format";
import { toBrandSearchParams, withBrandChanges, type BrandPageState } from "@/lib/brandFilters";
import { chartChrome, colors } from "@/lib/theme";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { ChartCard } from "@/components/ui/ChartCard";
import { EmptyState } from "@/components/ui/States";

function BrandTooltip({ active, payload }: { active?: boolean; payload?: { payload: BrandReviewStat }[] }) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  return (
    <ChartTooltip
      title={b.brand_name}
      rows={[
        { label: "Average rating", value: formatRating(b.average_rating) },
        { label: "Reviews", value: formatInteger(b.review_count) },
        { label: "Reviewed products", value: formatInteger(b.reviewed_products) },
        {
          label: "Recommend rate",
          value: b.recommendation_rate === null ? "—" : formatPercent(b.recommendation_rate),
        },
      ]}
    />
  );
}

/** 8px dot with a surface ring inside a 24px hit area; the focused brand is larger and outlined. */
function makeDot(focus?: string) {
  return function BrandDot(props: { cx?: number; cy?: number; payload?: BrandReviewStat }) {
    const { cx = 0, cy = 0, payload } = props;
    const selected = payload?.brand_name === focus;
    return (
      <g style={{ cursor: "pointer" }}>
        <circle cx={cx} cy={cy} r={12} fill="transparent" />
        <circle
          cx={cx}
          cy={cy}
          r={selected ? 7 : 4.5}
          fill={colors.burgundy}
          fillOpacity={selected ? 1 : 0.55}
          stroke={selected ? colors.charcoal : colors.white}
          strokeWidth={selected ? 2 : 1.5}
        />
      </g>
    );
  };
}

const LOG_TICKS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000];

export function BrandLandscapeCard({ data, state }: { data: BrandReviewStats; state: BrandPageState }) {
  const { setQuery } = useNavigationTransition();
  const points = data.items;
  const minX = Math.max(1, data.min_reviews);
  const maxX = Math.max(minX + 1, ...points.map((p) => p.review_count));
  const xTicks = LOG_TICKS.filter((t) => t >= minX && t <= maxX * 1.1);
  const lowest = Math.min(5, ...points.map((p) => p.average_rating));
  const yMin = Math.max(1, Math.floor((lowest - 0.05) * 2) / 2);
  const yTicks = Array.from({ length: Math.round((5 - yMin) * 2) + 1 }, (_, i) => yMin + i * 0.5);
  const focus = (brand: string) => setQuery(toBrandSearchParams(withBrandChanges(state, { brand })));

  return (
    <ChartCard
      title="Brand landscape: rating versus review volume"
      subtitle={`Each dot is one of the ${plural(data.brands_meeting_threshold, "brand")} with at least ${plural(
        data.min_reviews,
        "review",
      )}. Select a dot to focus that brand. Review volume uses a log scale.`}
      scope="reviews"
      table={{
        columns: [
          { key: "brand", label: "Brand" },
          { key: "reviews", label: "Reviews", align: "right" },
          { key: "rating", label: "Avg rating", align: "right" },
          { key: "five", label: "5★ share", align: "right" },
          { key: "rec", label: "Recommend rate", align: "right" },
        ],
        rows: points.map((b) => ({
          brand: b.brand_name,
          reviews: formatInteger(b.review_count),
          rating: formatRating(b.average_rating),
          five: formatPercent(b.five_star_share),
          rec: b.recommendation_rate === null ? "—" : formatPercent(b.recommendation_rate),
        })),
      }}
    >
      {points.length === 0 ? (
        <EmptyState message={`No brand has at least ${formatInteger(data.min_reviews)} reviews in this selection. Lower the minimum to see more brands.`} />
      ) : (
        <div
          className="h-[340px]"
          role="img"
          aria-label="Scatter plot of average rating against number of reviews per brand"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 12, bottom: 18, left: 0 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="" />
              <XAxis
                type="number"
                dataKey="review_count"
                name="Reviews"
                scale="log"
                domain={[minX, Math.ceil(maxX * 1.1)]}
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
                domain={[yMin, 5]}
                ticks={yTicks}
                tickFormatter={(n: number) => n.toFixed(1)}
                tick={chartChrome.tick}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<BrandTooltip />} cursor={false} isAnimationActive={false} />
              <Scatter
                data={points}
                shape={makeDot(state.brand)}
                isAnimationActive={false}
                onClick={(p: { payload?: BrandReviewStat }) => p.payload && focus(p.payload.brand_name)}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
