"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { formatCompact, formatInteger } from "@/lib/format";
import { colors } from "@/lib/theme";

export interface BarDatum {
  label: string;
  value: number;
}

interface BarChartCardProps {
  title: string;
  subtitle?: string;
  data: BarDatum[];
  height?: number;
}

/** Reusable single-series bar chart in the brand style. */
export function BarChartCard({ title, subtitle, data, height = 280 }: BarChartCardProps) {
  return (
    <Card title={title} subtitle={subtitle}>
      {data.length === 0 ? (
        <p className="py-10 text-center text-sm text-charcoal/50">No data available.</p>
      ) : (
        <div style={{ height }} role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={colors.softPink} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                tickFormatter={formatCompact}
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={48}
              />
              <Tooltip
                cursor={{ fill: colors.softPink }}
                formatter={(v) => formatInteger(Number(v))}
              />
              <Bar dataKey="value" fill={colors.burgundy} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
