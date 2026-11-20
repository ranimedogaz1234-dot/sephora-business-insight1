import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { QualityCheck } from "@/lib/api/types";

const STATUS = {
  pass: { label: "Pass", icon: CircleCheck, className: "text-burgundy" },
  warn: { label: "Review", icon: CircleAlert, className: "text-charcoal" },
  info: { label: "Info", icon: Info, className: "text-ink-3" },
} as const;

/** Data-quality checks; status is carried by an icon and a text label, never colour alone. */
export function QualityChecks({ checks }: { checks: QualityCheck[] }) {
  const counts = checks.reduce<Record<string, number>>((a, c) => ({ ...a, [c.status]: (a[c.status] ?? 0) + 1 }), {});
  return (
    <section aria-labelledby="quality-heading" className="min-w-0 rounded-xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-3">Data quality</p>
          <h2 id="quality-heading" className="mt-2 text-[15px] font-semibold text-charcoal">
            Quality checks
          </h2>
        </div>
        <p className="text-xs text-ink-3">
          {counts.pass ?? 0} passed · {counts.warn ?? 0} to review · {counts.info ?? 0} informational
        </p>
      </div>
      <ul className="mt-4 grid gap-x-8 md:grid-cols-2">
        {checks.map((c) => {
          const s = STATUS[c.status];
          const Icon = s.icon;
          return (
            <li key={c.name} className="flex gap-3 border-t border-line py-3">
              <Icon aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${s.className}`} strokeWidth={2} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-medium text-charcoal">{c.name}</p>
                  <p className="text-sm tabular-nums text-charcoal">{c.value}</p>
                </div>
                <p className="mt-0.5 text-xs text-ink-3">
                  <span className={`font-medium ${s.className}`}>{s.label}.</span> {c.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
