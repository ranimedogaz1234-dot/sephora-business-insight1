"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PriceBin, PriceDistribution } from "@/lib/api/types";
import { axisFormatter, formatInteger, formatPercent, formatUsd } from "@/lib/format";
import { chartChrome, colors } from "@/lib/theme";
import { ChartCard } from "@/components/ui/ChartCard";
import { ChartTooltip } from "./ChartTooltip";

interface Row extends PriceBin {
  share: number;
}

function PriceTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <ChartTooltip
      title={r.label}
      rows={[
        { label: "Products", value: formatInteger(r.product_count) },
        { label: "Share", value: formatPercent(r.share) },
      ]}
    />
  );
}

export function PriceDistributionCard({ data }: { data: PriceDistribution }) {
  const total = data.stats.count || 1;
  const rows: Row[] = data.bins.map((b) => ({ ...b, share: b.product_count / total }));
  const s = data.stats;
  const yFormat = axisFormatter(Math.max(0, ...rows.map((r) => r.product_count)));
  return (
    <ChartCard
      title="Price distribution"
      subtitle={`${formatInteger(s.count)} products · median ${s.median === null ? "—" : formatUsd(s.median)} · middle half ${
        s.p25 === null || s.p75 === null ? "—" : `${formatUsd(s.p25)}–${formatUsd(s.p75)}`
      }`}
      scope="catalogue"
      table={{
        columns: [
          { key: "label", label: "Price range" },
          { key: "count", label: "Products", align: "right" },
          { key: "share", label: "Share", align: "right" },
        ],
        rows: rows.map((r) => ({ label: r.label, count: formatInteger(r.product_count), share: formatPercent(r.share) })),
      }}
      footnote={`$${data.bin_width} bins; every product priced ${formatUsd(data.max_price)} or more shares the last bin (max ${
        s.max === null ? "—" : formatUsd(s.max)
      }).`}
    >
      <div className="h-[340px]" role="img" aria-label="Histogram of product prices">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid {...chartChrome.grid} />
            <XAxis
              dataKey="label"
              tick={chartChrome.tick}
              axisLine={false}
              tickLine={false}
              interval={0}
              tickFormatter={(label: string, i: number) =>
                i === rows.length - 1 ? label : i % 5 === 0 ? label.split("–")[0] : ""
              }
            />
            <YAxis tickFormatter={yFormat} tick={chartChrome.tick} axisLine={false} tickLine={false} width={44} />
            <Tooltip content={<PriceTooltip />} cursor={{ fill: colors.softPink }} isAnimationActive={false} />
            <Bar dataKey="product_count" fill={colors.burgundy} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
