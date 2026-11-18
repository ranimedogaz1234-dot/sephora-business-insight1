const integer = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const formatInteger = (n: number) => integer.format(n);
export const formatCompact = (n: number) => compact.format(n);
export const formatPercent = (ratio: number, digits = 1) => `${(ratio * 100).toFixed(digits)}%`;
export const formatRating = (n: number) => n.toFixed(2);

export function formatMonthYear(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}
