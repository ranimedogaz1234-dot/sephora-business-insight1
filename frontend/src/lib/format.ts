const integer = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const formatInteger = (n: number) => integer.format(n);
export const formatCompact = (n: number) => compact.format(n);
export const formatPercent = (ratio: number, digits = 1) => `${(ratio * 100).toFixed(digits)}%`;
export const formatRating = (n: number) => n.toFixed(2);
export const formatUsd = (n: number) => usd.format(n);

/** Compact only from 10,000 up, so small numbers stay exact. For single labels. */
export const formatAxis = (n: number) => (Math.abs(n) >= 10_000 ? formatCompact(n) : formatInteger(n));

/**
 * Tick formatter with ONE style per axis: compact when the axis reaches 10,000
 * (0 / 10K / 20K), otherwise full numbers (0 / 1,000 / 2,000).
 */
export function axisFormatter(axisMax: number): (n: number) => string {
  return axisMax >= 10_000 ? formatCompact : formatInteger;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthName = (m: number) => MONTHS[m - 1] ?? String(m);

export function formatMonthYear(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "1 brand", "142 brands" — count with a correctly pluralised noun. */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatInteger(n)} ${n === 1 ? singular : pluralForm}`;
}
