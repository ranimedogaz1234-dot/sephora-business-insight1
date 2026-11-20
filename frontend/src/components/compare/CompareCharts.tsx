"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComparedProduct, ProductComparison } from "@/lib/api/types";
import { toCompareSearchParams, type CompareState } from "@/lib/compareState";
import { axisFormatter, formatCompact, formatInteger, formatPercent } from "@/lib/format";
import { chartChrome, colors, compareColors } from "@/lib/theme";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";
import { ChartTooltip } from "@/components/charts/ChartTooltip";
import { ChartCard } from "@/components/ui/ChartCard";
import { EmptyState } from "@/components/ui/States";

const short = (name: string, n = 28) => (name.length > n ? `${name.slice(0, n - 1).trimEnd()}…` : name);

/** Legend: swatch + product name per series, in slot order (identity never relies on colour alone). */
export function CompareLegend({ items }: { items: Pick<ComparedProduct, "product_id" | "product_name" | "review_stats">[] }) {
  return (
    <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Legend">
      {items.map((p, i) => (
        <li key={p.product_id} className="inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-2">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: compareColors[i] }} />
          <span className="truncate" title={p.product_name}>
            {short(p.product_name, 40)}
            {p.review_stats.review_record_count === 0 && <span className="text-ink-3"> (no review records)</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

type Row = Record<string, string | number | null>;

function SeriesTooltip({
  active,
  payload,
  label,
  items,
  format,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; value?: number | null }[];
  label?: string | number;
  items: ComparedProduct[];
  format: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <ChartTooltip
      title={String(label)}
      rows={items.map((p, i) => {
        const hit = payload.find((x) => x.dataKey === `p${i}`);
        return {
          label: short(p.product_name, 32),
          value: hit?.value == null ? "—" : format(hit.value),
        };
      })}
    />
  );
}

export function RatingMixCompare({ items }: { items: ComparedProduct[] }) {
  const reviewed = items.filter((p) => p.review_stats.review_record_count > 0);
  const rows: Row[] = [5, 4, 3, 2, 1].map((star) => {
    const row: Row = { star: `${star}★` };
    items.forEach((p, i) => {
      const b = p.review_stats.rating_distribution.find((x) => x.rating === star);
      row[`p${i}`] = p.review_stats.review_record_count ? (b?.share ?? 0) : null;
    });
    return row;
  });

  return (
    <ChartCard
      title="Rating distribution"
      subtitle="Share of each product's review records at each star rating"
      scope="reviews"
      table={{
        columns: [{ key: "star", label: "Rating" }, ...items.map((p, i) => ({ key: `p${i}`, label: short(p.product_name, 24), align: "right" as const }))],
        rows: rows.map((r) => ({
          star: String(r.star),
          ...Object.fromEntries(items.map((_, i) => [`p${i}`, r[`p${i}`] == null ? "—" : formatPercent(Number(r[`p${i}`]))])),
        })),
      }}
    >
      {reviewed.length === 0 ? (
        <EmptyState message="None of these products has review records. The review dataset covers Skincare only." />
      ) : (
        <>
          <CompareLegend items={items} />
          <div className="h-[280px]" role="img" aria-label="Grouped bar chart of the rating distribution per product">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
                <CartesianGrid {...chartChrome.grid} />
                <XAxis dataKey="star" tick={chartChrome.tick} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(n: number) => `${Math.round(n * 100)}%`}
                  tick={chartChrome.tick}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  content={<SeriesTooltip items={items} format={(n) => formatPercent(n)} />}
                  cursor={{ fill: colors.softPink, fillOpacity: 0.6 }}
                  isAnimationActive={false}
                />
                {items.map((p, i) => (
                  <Bar
                    key={p.product_id}
                    dataKey={`p${i}`}
                    name={p.product_name}
                    fill={compareColors[i]}
                    radius={[4, 4, 0, 0]}
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

export function ActivityCompare({ data, state }: { data: ProductComparison; state: CompareState }) {
  const { setQuery } = useNavigationTransition();
  const items = data.items;
  // Products without review records are not drawn as a zero line (they were not measured).
  const rows: Row[] = data.periods.map((p) => ({
    period: p.period,
    ...Object.fromEntries(
      p.review_counts.map((c, i) => [`p${i}`, items[i].review_stats.review_record_count ? c : null]),
    ),
  }));
  const yFormat = axisFormatter(Math.max(0, ...data.periods.flatMap((p) => p.review_counts)));

  const action = (
    <div role="group" aria-label="Time granularity" className="flex rounded-md border border-line p-0.5">
      {(["year", "quarter"] as const).map((g) => (
        <button
          key={g}
          type="button"
          aria-pressed={state.grain === g}
          onClick={() => setQuery(toCompareSearchParams({ ...state, grain: g }))}
          className={`h-7 rounded px-2.5 text-xs transition-colors ${
            state.grain === g ? "bg-soft-pink font-medium text-burgundy" : "text-ink-3 hover:text-charcoal"
          }`}
        >
          {g === "year" ? "Yearly" : "Quarterly"}
        </button>
      ))}
    </div>
  );

  return (
    <ChartCard
      title="Review activity"
      subtitle={`Review records per ${state.grain}, on one shared timeline`}
      scope="reviews"
      action={action}
      table={{
        columns: [
          { key: "period", label: "Period" },
          ...items.map((p, i) => ({ key: `p${i}`, label: short(p.product_name, 24), align: "right" as const })),
        ],
        rows: rows.map((r) => ({
          period: String(r.period),
          ...Object.fromEntries(items.map((_, i) => [`p${i}`, r[`p${i}`] === null ? "—" : formatInteger(Number(r[`p${i}`]))])),
        })),
      }}
    >
      {rows.length === 0 ? (
        <EmptyState message="None of these products has review records. The review dataset covers Skincare only." />
      ) : (
        <>
          <CompareLegend items={items} />
          <div className="h-[280px]" role="img" aria-label={`Line chart of review records per ${state.grain} for each product`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid {...chartChrome.grid} />
                <XAxis
                  dataKey="period"
                  tick={chartChrome.tick}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                  tickFormatter={(p: string) => p.replace("-", " ")}
                />
                <YAxis tickFormatter={yFormat} tick={chartChrome.tick} axisLine={false} tickLine={false} width={48} allowDecimals={false} />
                <Tooltip
                  content={<SeriesTooltip items={items} format={formatInteger} />}
                  cursor={{ stroke: colors.ink3, strokeWidth: 1 }}
                  isAnimationActive={false}
                />
                {items.map((p, i) => (
                  <Line
                    key={p.product_id}
                    type="linear"
                    dataKey={`p${i}`}
                    name={p.product_name}
                    stroke={compareColors[i]}
                    strokeWidth={2}
                    dot={rows.length <= 12 ? { r: 3.5, fill: compareColors[i], stroke: colors.white, strokeWidth: 2 } : false}
                    activeDot={{ r: 4.5, fill: compareColors[i], stroke: colors.white, strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </ChartCard>
  );
}

const POPULARITY = {
  loves: { label: "Loves", note: "Sephora 'loves' from the catalogue", value: (p: ComparedProduct) => p.loves_count },
  records: {
    label: "Review records",
    note: "Rows in the review dataset (Skincare only)",
    value: (p: ComparedProduct) => p.review_stats.review_record_count,
  },
  sephora: {
    label: "Sephora-listed reviews",
    note: "Sephora's catalogue review count",
    value: (p: ComparedProduct) => p.sephora_review_count ?? 0,
  },
} as const;

type PopularityKey = keyof typeof POPULARITY;

/** One popularity measure at a time, so every bar shares one axis (never a dual-axis chart). */
export function PopularityCompare({ items }: { items: ComparedProduct[] }) {
  const [metric, setMetric] = useState<PopularityKey>("loves");
  const m = POPULARITY[metric];
  const rows = items.map((p, i) => ({ name: short(p.product_name, 18), value: m.value(p), slot: i }));

  const action = (
    <div role="group" aria-label="Popularity measure" className="flex flex-wrap rounded-md border border-line p-0.5">
      {(Object.keys(POPULARITY) as PopularityKey[]).map((k) => (
        <button
          key={k}
          type="button"
          aria-pressed={metric === k}
          onClick={() => setMetric(k)}
          className={`h-7 rounded px-2.5 text-xs transition-colors ${
            metric === k ? "bg-soft-pink font-medium text-burgundy" : "text-ink-3 hover:text-charcoal"
          }`}
        >
          {POPULARITY[k].label}
        </button>
      ))}
    </div>
  );

  return (
    <ChartCard
      title="Popularity"
      subtitle={m.note}
      scope={metric === "records" ? "reviews" : "catalogue"}
      action={action}
      table={{
        columns: [
          { key: "product", label: "Product" },
          ...(Object.keys(POPULARITY) as PopularityKey[]).map((k) => ({ key: k, label: POPULARITY[k].label, align: "right" as const })),
        ],
        rows: items.map((p) => ({
          product: p.product_name,
          ...Object.fromEntries((Object.keys(POPULARITY) as PopularityKey[]).map((k) => [k, formatInteger(POPULARITY[k].value(p))])),
        })),
      }}
    >
      <div className="h-[240px]" role="img" aria-label={`Bar chart of ${m.label.toLowerCase()} per product`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 56, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid {...chartChrome.grid} vertical horizontal={false} />
            <XAxis type="number" tickFormatter={(n: number) => formatCompact(n)} tick={chartChrome.tick} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={chartChrome.tick} axisLine={false} tickLine={false} width={116} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.slot} fill={compareColors[r.slot]} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: unknown) => formatCompact(Number(v))}
                style={{ fill: colors.charcoal, fontSize: 12 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
