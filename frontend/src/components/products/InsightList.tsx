import { CircleAlert, CircleCheck, Info } from "lucide-react";
import type { Insight, InsightTone } from "@/lib/insights";

const TONES: Record<InsightTone, { icon: typeof Info; className: string; label: string }> = {
  positive: { icon: CircleCheck, className: "text-burgundy", label: "Strength" },
  neutral: { icon: Info, className: "text-ink-3", label: "Context" },
  attention: { icon: CircleAlert, className: "text-burgundy-deep", label: "Watch" },
};

/** Data-derived insight statements. Tone is conveyed by text as well as icon. */
export function InsightList({ insights }: { insights: Insight[] }) {
  if (!insights.length) {
    return <p className="text-sm text-ink-3">Not enough data for insights on this product.</p>;
  }
  return (
    <ul className="space-y-4">
      {insights.map((i) => {
        const tone = TONES[i.tone];
        const Icon = tone.icon;
        return (
          <li key={i.id} className="flex gap-3">
            <Icon aria-hidden className={`mt-0.5 h-4 w-4 shrink-0 ${tone.className}`} strokeWidth={2} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-charcoal">
                <span className="sr-only">{tone.label}: </span>
                {i.title}
              </p>
              <p className="mt-0.5 text-xs text-ink-2">{i.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
