export function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        ok ? "bg-soft-pink text-burgundy" : "bg-light-gray text-charcoal/60"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-burgundy" : "bg-charcoal/40"}`}
      />
      {label}
    </span>
  );
}
