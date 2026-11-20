import type { SentimentLabel } from "@/lib/api/types";
import { formatPercent } from "@/lib/format";
import { sentimentColors } from "@/lib/theme";

export const SENTIMENT_LABELS: { key: SentimentLabel; label: string }[] = [
  { key: "negative", label: "Negative" },
  { key: "neutral", label: "Neutral" },
  { key: "positive", label: "Positive" },
];

/**
 * 100% stacked bar, negative to positive, with a 2px surface gap between segments.
 * The figures are also given as text (aria-label and visible legend), never colour alone.
 */
export function SentimentBar({ shares, className = "h-2.5" }: { shares: Record<SentimentLabel, number>; className?: string }) {
  const text = SENTIMENT_LABELS.map((s) => `${s.label} ${formatPercent(shares[s.key])}`).join(", ");
  return (
    <div role="img" aria-label={text} title={text} className={`flex w-full gap-[2px] overflow-hidden rounded-full ${className}`}>
      {SENTIMENT_LABELS.map((s) =>
        shares[s.key] > 0 ? (
          <div key={s.key} style={{ width: `${shares[s.key] * 100}%`, background: sentimentColors[s.key] }} />
        ) : null,
      )}
    </div>
  );
}

export function SentimentLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legend">
      {[...SENTIMENT_LABELS].reverse().map((s) => (
        <li key={s.key} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: sentimentColors[s.key] }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
