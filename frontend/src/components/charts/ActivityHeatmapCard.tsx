"use client";

import { useMemo, useState } from "react";
import type { ActivityHeatmap } from "@/lib/api/types";
import { binIndex, heatmapGrid, powerBreaks } from "@/lib/aggregate";
import { formatInteger, monthName } from "@/lib/format";
import { sequentialRamp } from "@/lib/theme";
import { ChartCard } from "@/components/ui/ChartCard";
import { EmptyState } from "@/components/ui/States";
import { ChartTooltip } from "./ChartTooltip";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface Hover {
  year: number;
  month: number;
  count: number;
  x: number;
  y: number;
}

export function ActivityHeatmapCard({ data }: { data: ActivityHeatmap }) {
  const grid = useMemo(() => heatmapGrid(data.cells), [data.cells]);
  const breaks = useMemo(
    () => powerBreaks(data.cells.map((c) => c.review_count), sequentialRamp.length),
    [data.cells],
  );
  const [hover, setHover] = useState<Hover | null>(null);
  const years = [...data.years].reverse(); // newest first

  const legend = useMemo(() => {
    const bounds = [1, ...breaks];
    return bounds.map((lo, i) => ({
      color: sequentialRamp[i],
      label: i < breaks.length ? `${formatInteger(lo)}–${formatInteger(breaks[i] - 1)}` : `${formatInteger(lo)}+`,
    }));
  }, [breaks]);

  const show = (el: HTMLElement, year: number, month: number, count: number) => {
    const box = el.getBoundingClientRect();
    const host = el.closest("[data-heatmap]")!.getBoundingClientRect();
    setHover({ year, month, count, x: box.left - host.left + box.width / 2, y: box.top - host.top });
  };

  return (
    <ChartCard
      title="Review activity heatmap"
      subtitle="Reviews per month, by year. Darker cells hold more reviews."
      scope="reviews"
      table={{
        columns: [{ key: "year", label: "Year" }, ...MONTHS.map((m) => ({ key: `m${m}`, label: monthName(m), align: "right" as const }))],
        rows: years.map((y) => ({
          year: String(y),
          ...Object.fromEntries((grid.get(y) ?? []).map((c, i) => [`m${i + 1}`, formatInteger(c)])),
        })),
      }}
    >
      {data.cells.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="relative" data-heatmap onMouseLeave={() => setHover(null)}>
          <div className="relative overflow-x-auto pb-1">
            <table className="w-full min-w-[640px] border-separate" style={{ borderSpacing: 2 }}>
              <caption className="sr-only">Monthly review counts by year</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-12" />
                  {MONTHS.map((m) => (
                    <th key={m} scope="col" className="pb-1 text-center text-[11px] font-normal text-ink-3">
                      {monthName(m)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y}>
                    <th scope="row" className="pr-2 text-right text-[11px] font-normal tabular-nums text-ink-3">
                      {y}
                    </th>
                    {(grid.get(y) ?? Array(12).fill(0)).map((count: number, i: number) => {
                      const bin = binIndex(count, breaks);
                      const label = `${monthName(i + 1)} ${y}: ${formatInteger(count)} reviews`;
                      return (
                        <td key={i} className="p-0">
                          <div
                            tabIndex={0}
                            role="img"
                            aria-label={label}
                            onMouseEnter={(e) => show(e.currentTarget, y, i + 1, count)}
                            onFocus={(e) => show(e.currentTarget, y, i + 1, count)}
                            onBlur={() => setHover(null)}
                            className="h-6 rounded-[3px] outline-offset-1 transition-transform hover:scale-110 focus-visible:scale-110"
                            style={{ background: bin < 0 ? "var(--light-gray)" : sequentialRamp[bin] }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hover && (
            <div
              className="absolute z-10 -translate-x-1/2 -translate-y-full"
              style={{ left: hover.x, top: hover.y - 6 }}
            >
              <ChartTooltip
                title={`${monthName(hover.month)} ${hover.year}`}
                rows={[{ label: "Reviews", value: formatInteger(hover.count) }]}
              />
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-ink-3" aria-label="Color scale">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-[3px] bg-light-gray ring-1 ring-line" aria-hidden />0
            </span>
            {legend.map((l) => (
              <span key={l.color} className="inline-flex items-center gap-1.5 tabular-nums">
                <span className="h-3 w-5 rounded-[3px]" style={{ background: l.color }} aria-hidden />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}
