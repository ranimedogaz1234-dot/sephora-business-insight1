interface TooltipRow {
  label: string;
  value: string;
}

/** Tooltip body: values lead (strong ink), labels follow (secondary ink). */
export function ChartTooltip({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="pointer-events-none min-w-36 max-w-64 rounded-lg border border-line bg-white px-3 py-2.5 shadow-[0_4px_16px_rgba(41,37,42,0.08)]">
      <p className="text-xs font-medium text-ink-2">{title}</p>
      <dl className="mt-1.5 space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-xs text-ink-3">{r.label}</dt>
            <dd className="text-sm font-semibold tabular-nums text-charcoal">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
