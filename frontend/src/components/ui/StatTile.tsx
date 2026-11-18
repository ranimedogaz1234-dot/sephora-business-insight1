import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  value: string;
  /** Optional unit shown after the value in muted ink (e.g. "/ 5"). */
  unit?: string;
  note?: ReactNode;
  size?: "hero" | "default" | "compact";
}

/**
 * Stat tile: sentence-case label, sans semibold value (proportional figures), optional note.
 * The hero size is used for exactly one figure per view.
 */
export function StatTile({ label, value, unit, note, size = "default" }: StatTileProps) {
  const valueClass =
    size === "hero"
      ? "text-[44px] leading-none sm:text-[52px]"
      : size === "compact"
        ? "text-xl"
        : "text-[28px] leading-none";
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p className={`mt-2 font-semibold tracking-tight text-burgundy ${valueClass}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-ink-3">{unit}</span>}
      </p>
      {note && <p className="mt-2 text-xs text-ink-3">{note}</p>}
    </div>
  );
}
