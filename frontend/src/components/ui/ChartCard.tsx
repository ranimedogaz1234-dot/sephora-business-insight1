"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { DataTable, type TableColumn, type TableRow } from "./DataTable";
import { ScopeTag, type Scope } from "./ScopeTag";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  scope: Scope;
  /** Header control (e.g. a year selector) shown next to the title. */
  action?: ReactNode;
  /** When provided, a Chart/Table toggle is shown and the table is the accessible twin. */
  table?: { columns: TableColumn[]; rows: TableRow[] };
  footnote?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  scope,
  action,
  table,
  footnote,
  className = "",
  children,
}: ChartCardProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={`flex min-w-0 flex-col rounded-xl border border-line bg-white p-5 transition-colors hover:border-line-strong sm:p-6 ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <ScopeTag scope={scope} />
          <h2 id={headingId} className="mt-2 text-[15px] font-semibold text-charcoal">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {table && (
            <div role="group" aria-label={`${title} view`} className="flex rounded-md border border-line p-0.5">
              {(["chart", "table"] as const).map((v) => {
                const Icon = v === "chart" ? BarChart3 : Table2;
                const selected = view === v;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setView(v)}
                    title={v === "chart" ? "Chart view" : "Table view"}
                    className={`grid h-7 w-7 place-items-center rounded transition-colors ${
                      selected ? "bg-soft-pink text-burgundy" : "text-ink-3 hover:text-charcoal"
                    }`}
                  >
                    <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    <span className="sr-only">{v === "chart" ? "Chart view" : "Table view"}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 min-w-0 flex-1">
        {view === "table" && table ? (
          <DataTable caption={title} columns={table.columns} rows={table.rows} />
        ) : (
          children
        )}
      </div>
      {footnote && <p className="mt-4 text-xs text-ink-3">{footnote}</p>}
    </section>
  );
}
