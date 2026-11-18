"use client";

import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Granularity, TrendPoint } from "@/lib/api/types";
import { aggregateTrend, type PeriodRow } from "@/lib/aggregate";
import { axisFormatter, formatInteger, formatRating, monthName } from "@/lib/format";
import { chartChrome, colors } from "@/lib/theme";
import { ChartCard } from "@/components/ui/ChartCard";
import { EmptyState } from "@/components/ui/States";
import { ChartTooltip } from "./ChartTooltip";

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
  { value: "year", label: "Yearly" },
];

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: PeriodRow }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <ChartTooltip
      title={row.period}
      rows={[
        { label: "Reviews", value: formatInteger(row.reviewCount) },
        {
          label: "Average rating",
          value: row.averageRating === null ? "—" : formatRating(row.averageRating),
        },
      ]}
    />
  );
}

export function ReviewActivityCard({ points }: { points: TrendPoint[] }) {
  const [granularity, setGranularity] = useState<Granularity>("month");
  const rows = useMemo(() => aggregateTrend(points, granularity), [points, granularity]);
  const yFormat = axisFormatter(Math.max(0, ...rows.map((r) => r.reviewCount)));
  const peak = rows.reduce<PeriodRow | null>((a, r) => (!a || r.reviewCount > a.reviewCount ? r : a), null);

  // Short ranges (<= 2 years of periods) label every period; long ranges label each
  // January (thinned to every other year when crowded) with the year only.
  const short = granularity === "year" || rows.length <= (granularity === "month" ? 24 : 8);
  const ticks = useMemo(() => {
    if (short) return undefined;
    const firsts = rows.filter((r) => r.start.endsWith("-01-01")).map((r) => r.period);
    const step = firsts.length > 8 ? 2 : 1;
    return firsts.filter((_, i) => i % step === 0);
  }, [rows, short]);
  const tickLabel = (p: string) => {
    if (!short || granularity === "year") return p.slice(0, 4);
    if (granularity === "quarter") return p.replace("-", " ");
    const [y, m] = p.split("-");
    return m === "01" || rows.length <= 12 ? `${monthName(Number(m))} ${y.slice(2)}` : monthName(Number(m));
  };

  const action = (
    <div role="group" aria-label="Time granularity" className="flex rounded-md border border-line p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={granularity === o.value}
          onClick={() => setGranularity(o.value)}
          className={`h-7 rounded px-2.5 text-xs transition-colors ${
            granularity === o.value ? "bg-soft-pink font-medium text-burgundy" : "text-ink-3 hover:text-charcoal"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <ChartCard
      title="Review activity over time"
      subtitle={
        peak && peak.reviewCount > 0
          ? `Peak ${granularity}: ${peak.period} with ${formatInteger(peak.reviewCount)} reviews`
          : "Number of review records per period"
      }
      scope="reviews"
      action={action}
      table={{
        columns: [
          { key: "period", label: "Period" },
          { key: "reviews", label: "Reviews", align: "right" },
          { key: "rating", label: "Average rating", align: "right" },
        ],
        rows: rows.map((r) => ({
          period: r.period,
          reviews: formatInteger(r.reviewCount),
          rating: r.averageRating === null ? "—" : formatRating(r.averageRating),
        })),
      }}
    >
      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="h-[280px]" role="img" aria-label={`Area chart of reviews per ${granularity}`}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid {...chartChrome.grid} />
              <XAxis
                dataKey="period"
                ticks={ticks}
                tickFormatter={tickLabel}
                tick={chartChrome.tick}
                axisLine={false}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis
                tickFormatter={yFormat}
                tick={chartChrome.tick}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                content={<TrendTooltip />}
                cursor={{ stroke: colors.ink3, strokeWidth: 1 }}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="reviewCount"
                stroke={colors.burgundy}
                strokeWidth={2}
                fill={colors.burgundy}
                fillOpacity={0.08}
                activeDot={{ r: 4, fill: colors.burgundy, stroke: colors.white, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
