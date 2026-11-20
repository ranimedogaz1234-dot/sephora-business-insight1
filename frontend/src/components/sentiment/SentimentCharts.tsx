"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SentimentSummary, SentimentTrend } from "@/lib/api/types";
import { axisFormatter, formatInteger, formatPercent } from "@/lib/format";
import { chartChrome, colors, sentimentColors } from "@/lib/theme";
import { toSentimentSearchParams, type SentimentState } from "@/lib/sentimentState";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { ChartCard } from "@/components/ui/ChartCard";
import { EmptyState } from "@/components/ui/States";
import { SENTIMENT_LABELS, SentimentLegend } from "./SentimentBar";

/** Donut of the three-way split, with every share printed beside it. */
export function SentimentDonutCard({ data }: { data: SentimentSummary }) {
  const slices = [...SENTIMENT_LABELS].reverse().map((s) => {
    const d = data.distribution.find((x) => x.label === s.key)!;
    return { key: s.key, name: s.label, value: d.count, share: d.share };
  });
  return (
    <ChartCard
      title="Sentiment distribution"
      subtitle={`${formatInteger(data.classified)} classified reviews in this selection`}
      scope="reviews"
      table={{
        columns: [
          { key: "label", label: "Sentiment" },
          { key: "count", label: "Reviews", align: "right" },
          { key: "share", label: "Share", align: "right" },
        ],
        rows: slices.map((s) => ({ label: s.name, count: formatInteger(s.value), share: formatPercent(s.share) })),
      }}
    >
      {data.classified === 0 ? (
        <EmptyState message="No classified reviews match this selection." />
      ) : (
        <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="relative h-[220px]" role="img" aria-label={slices.map((s) => `${s.name} ${formatPercent(s.share)}`).join(", ")}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="92%"
                  paddingAngle={1}
                  stroke={colors.white}
                  strokeWidth={2}
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={false}
                >
                  {slices.map((s) => (
                    <Cell key={s.key} fill={sentimentColors[s.key]} />
                  ))}
                </Pie>
                <Tooltip
                  isAnimationActive={false}
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <ChartTooltip
                        title={String(payload[0].name)}
                        rows={[
                          { label: "Reviews", value: formatInteger(Number(payload[0].value)) },
                          { label: "Share", value: formatPercent(Number((payload[0].payload as { share: number }).share)) },
                        ]}
                      />
                    ) : null
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold tabular-nums text-charcoal">{formatInteger(data.classified)}</span>
              <span className="text-[11px] text-ink-3">classified</span>
            </div>
          </div>
          <ul className="space-y-3" aria-label="Sentiment shares">
            {slices.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3 border-b border-line pb-2.5 last:border-0">
                <span className="inline-flex items-center gap-2 text-sm text-charcoal">
                  <span aria-hidden className="h-3 w-3 rounded-sm" style={{ background: sentimentColors[s.key] }} />
                  {s.name}
                </span>
                <span className="text-right tabular-nums">
                  <span className="text-lg font-semibold text-charcoal">{formatPercent(s.share)}</span>
                  <span className="ml-2 text-xs text-ink-3">{formatInteger(s.value)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

const GRAINS = [
  { value: "year", label: "Yearly" },
  { value: "quarter", label: "Quarterly" },
  { value: "month", label: "Monthly" },
] as const;

export function SentimentTrendCard({ data, state }: { data: SentimentTrend; state: SentimentState }) {
  const { setQuery } = useNavigationTransition();
  const rows = data.points.map((p) => ({
    period: p.period,
    classified: p.classified,
    negative: p.negative,
    neutral: p.neutral,
    positive: p.positive,
  }));
  const yFormat = axisFormatter(Math.max(0, ...rows.map((r) => r.classified)));
  const action = (
    <div role="group" aria-label="Time granularity" className="flex rounded-md border border-line p-0.5">
      {GRAINS.map((g) => (
        <button
          key={g.value}
          type="button"
          aria-pressed={state.grain === g.value}
          onClick={() => setQuery(toSentimentSearchParams({ ...state, grain: g.value }))}
          className={`h-7 rounded px-2.5 text-xs transition-colors ${
            state.grain === g.value ? "bg-soft-pink font-medium text-burgundy" : "text-ink-3 hover:text-charcoal"
          }`}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
  return (
    <ChartCard
      title="Sentiment over time"
      subtitle="Classified reviews per period, stacked negative to positive"
      scope="reviews"
      action={action}
      table={{
        columns: [
          { key: "period", label: "Period" },
          { key: "classified", label: "Classified", align: "right" },
          { key: "positive", label: "Positive", align: "right" },
          { key: "neutral", label: "Neutral", align: "right" },
          { key: "negative", label: "Negative", align: "right" },
          { key: "neg_share", label: "Negative share", align: "right" },
        ],
        rows: rows.map((r) => ({
          period: r.period,
          classified: formatInteger(r.classified),
          positive: formatInteger(r.positive),
          neutral: formatInteger(r.neutral),
          negative: formatInteger(r.negative),
          neg_share: r.classified ? formatPercent(r.negative / r.classified) : "—",
        })),
      }}
    >
      {rows.length === 0 ? (
        <EmptyState message="No classified reviews match this selection." />
      ) : (
        <>
          <div className="mb-3">
            <SentimentLegend />
          </div>
          <div className="h-[240px]" role="img" aria-label={`Stacked bar chart of classified reviews per ${state.grain} by sentiment`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="18%">
                <CartesianGrid {...chartChrome.grid} />
                <XAxis dataKey="period" tick={chartChrome.tick} axisLine={false} tickLine={false} minTickGap={12} />
                <YAxis tickFormatter={yFormat} tick={chartChrome.tick} axisLine={false} tickLine={false} width={48} allowDecimals={false} />
                <Tooltip
                  isAnimationActive={false}
                  cursor={{ fill: colors.softPink, fillOpacity: 0.6 }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <ChartTooltip
                        title={String(label)}
                        rows={[...SENTIMENT_LABELS].reverse().map((s) => {
                          const row = payload[0].payload as Record<string, number>;
                          return {
                            label: s.label,
                            value: `${formatInteger(row[s.key])} (${row.classified ? formatPercent(row[s.key] / row.classified) : "—"})`,
                          };
                        })}
                      />
                    ) : null
                  }
                />
                {SENTIMENT_LABELS.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stackId="sentiment"
                    fill={sentimentColors[s.key]}
                    stroke={colors.white}
                    strokeWidth={1}
                    radius={i === SENTIMENT_LABELS.length - 1 ? [4, 4, 0, 0] : 0}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </ChartCard>
  );
}
