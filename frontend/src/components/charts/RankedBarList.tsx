export interface RankedItem {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
  /** Formatted value printed at the bar tip. */
  display: string;
  /** Optional secondary figure under the value. */
  secondary?: string;
}

interface RankedBarListProps {
  items: RankedItem[];
  /** Scale maximum; defaults to the largest value. Use a fixed max (e.g. 5 for ratings). */
  max?: number;
  ranked?: boolean;
  ariaLabel: string;
}

/**
 * Ranked horizontal bars as an accessible list: name, thin bar, value per row.
 * One hue for every bar (nominal categories are never colored by value). Every
 * value is printed, so no tooltip or table toggle is needed to read it.
 */
export function RankedBarList({ items, max, ranked = true, ariaLabel }: RankedBarListProps) {
  const scaleMax = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ol aria-label={ariaLabel} className="space-y-1">
      {items.map((item, i) => {
        const pct = Math.max(0, Math.min(100, (item.value / scaleMax) * 100));
        return (
          <li
            key={item.key}
            className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-md px-2 py-2 transition-colors hover:bg-soft-pink/60"
          >
            <span className="text-right text-xs tabular-nums text-ink-3">{ranked ? i + 1 : ""}</span>
            <div className="min-w-0">
              <p className="truncate text-sm text-charcoal" title={item.label}>
                {item.label}
                {item.sublabel && <span className="text-ink-3"> · {item.sublabel}</span>}
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bg-light-gray" aria-hidden>
                <div className="h-1.5 rounded-full bg-burgundy" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums text-charcoal">{item.display}</p>
              {item.secondary && (
                <p className="text-[11px] tabular-nums text-ink-3">{item.secondary}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
