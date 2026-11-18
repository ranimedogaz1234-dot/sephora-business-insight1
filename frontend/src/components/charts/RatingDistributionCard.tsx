"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RatingDistribution } from "@/lib/api/types";
import { axisFormatter, formatInteger, formatPercent, formatRating } from "@/lib/format";
import { chartChrome, colors } from "@/lib/theme";
import { ChartCard } from "@/components/ui/ChartCard";
import { EmptyState } from "@/components/ui/States";
import { ChartTooltip } from "./ChartTooltip";

interface Row {
  label: string;
  count: number;
  share: number;
}

function RatingTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <ChartTooltip
      title={r.label}
      rows={[
        { label: "Reviews", value: formatInteger(r.count) },
        { label: "Share", value: formatPercent(r.share) },
      ]}
    />
  );
}

export function RatingDistributionCard({ data }: { data: RatingDistribution }) {
  const rows: Row[] = data.buckets.map((b) => ({
    label: `${b.rating} star${b.rating === 1 ? "" : "s"}`,
    count: b.count,
    share: b.share,
  }));
  const yFormat = axisFormatter(Math.max(0, ...rows.map((r) => r.count)));
  return (
    <ChartCard
      title="Rating distribution"
      subtitle={
        data.average_rating === null
          ? "Share of reviews per star rating"
          : `Average ${formatRating(data.average_rating)} across ${formatInteger(data.total)} reviews`
      }
      scope="reviews"
      table={{
        columns: [
          { key: "label", label: "Rating" },
          { key: "count", label: "Reviews", align: "right" },
          { key: "share", label: "Share", align: "right" },
        ],
        rows: rows.map((r) => ({ label: r.label, count: formatInteger(r.count), share: formatPercent(r.share) })),
      }}
    >
      {data.total === 0 ? (
        <EmptyState />
      ) : (
        <div className="h-[280px]" role="img" aria-label="Column chart of reviews per star rating">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 22, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
              <CartesianGrid {...chartChrome.grid} />
              <XAxis dataKey="label" tick={chartChrome.tick} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={yFormat} tick={chartChrome.tick} axisLine={false} tickLine={false} width={52} />
              <Tooltip content={<RatingTooltip />} cursor={{ fill: colors.softPink }} isAnimationActive={false} />
              <Bar dataKey="count" fill={colors.burgundy} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
                <LabelList
                  dataKey="share"
                  position="top"
                  formatter={(v: unknown) => formatPercent(Number(v), 0)}
                  style={{ fill: colors.ink2, fontSize: 12 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
