interface KpiCardProps {
  label: string;
  value: string;
  /** Short note on where the figure comes from (e.g. "Review records"). */
  source?: string;
}

export function KpiCard({ label, value, source }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-soft-pink bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-charcoal/60">{label}</p>
      <p className="mt-2 font-display text-3xl text-burgundy">{value}</p>
      {source && <p className="mt-1 text-xs text-charcoal/50">{source}</p>}
    </div>
  );
}
