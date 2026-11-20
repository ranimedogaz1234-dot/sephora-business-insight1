import { FlaskConical, Sparkles, Terminal } from "lucide-react";
import type { SentimentInsights, SentimentSummary } from "@/lib/api/types";
import { formatDate, formatInteger, formatPercent } from "@/lib/format";

/** Shown until any review has been classified: what the feature needs, nothing invented. */
export function NotActivated({ datasetReviews }: { datasetReviews: number }) {
  return (
    <section className="rounded-xl border border-dashed border-line-strong bg-white p-6 sm:p-8">
      <Sparkles aria-hidden className="h-6 w-6 text-burgundy" strokeWidth={1.75} />
      <h2 className="mt-3 text-lg font-semibold text-charcoal">Sentiment analysis has not been run yet</h2>
      <p className="mt-2 max-w-2xl text-sm text-ink-2">
        None of the {formatInteger(datasetReviews)} review records has a sentiment label, so this page shows no figures.
        Classification uses the Claude API from the backend and is started deliberately from the command line, with a
        cost estimate and an explicit spending limit. No sentiment is estimated or invented in the meantime.
      </p>
      <ol className="mt-5 space-y-3 text-sm text-ink-2">
        {[
          ["Add the API key", "Set ANTHROPIC_API_KEY in backend/.env (never committed, never sent to the browser)."],
          ["Estimate the cost (free)", "python -m app.sentiment.cli estimate --sample 2000"],
          ["Run a pilot", "python -m app.sentiment.cli run --sample 2000 --max-cost 3 --yes"],
        ].map(([title, detail], i) => (
          <li key={title} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-soft-pink text-xs font-semibold text-burgundy">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium text-charcoal">{title}</p>
              <p className="mt-0.5 break-words font-mono text-[12.5px] text-ink-2">
                {i > 0 && <Terminal aria-hidden className="mr-1.5 inline h-3.5 w-3.5 align-[-2px] text-ink-3" strokeWidth={2} />}
                {detail}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function SyntheticBanner() {
  return (
    <div role="note" className="flex gap-3 rounded-xl border border-elegant-pink bg-soft-pink/70 p-4 text-sm">
      <FlaskConical aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-burgundy" strokeWidth={2} />
      <p className="text-charcoal">
        <span className="font-semibold">Synthetic demo labels.</span> These labels were generated from star ratings for the
        synthetic test data so the page can be reviewed. They are not AI results and describe no real customer.
      </p>
    </div>
  );
}

export function CoverageStrip({ data }: { data: SentimentSummary }) {
  const run = data.last_run;
  return (
    <section aria-label="Classification coverage" className="rounded-xl border border-line bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 lg:flex-1">
          <p className="text-xs font-medium text-ink-2">Coverage in this selection</p>
          <p className="mt-1 text-[28px] font-semibold leading-none tracking-tight text-burgundy">
            {formatPercent(data.coverage)}
            <span className="ml-2 inline-block text-sm font-medium text-ink-3">
              {formatInteger(data.classified)} of {formatInteger(data.total_reviews)} reviews
            </span>
          </p>
          <div className="mt-3 h-1.5 w-full max-w-md rounded-full bg-light-gray" aria-hidden>
            <div className="h-1.5 rounded-full bg-burgundy" style={{ width: `${data.coverage * 100}%` }} />
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-ink-3">Whole dataset</dt>
            <dd className="mt-0.5 tabular-nums text-charcoal">
              {formatInteger(data.dataset_classified)} / {formatInteger(data.dataset_reviews)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-3">Source</dt>
            <dd className="mt-0.5 text-charcoal">{data.sources.map((s) => (s.name === "claude" ? "Claude API" : "Synthetic")).join(", ")}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Model</dt>
            <dd className="mt-0.5 font-mono text-[11.5px] text-charcoal">{data.models.join(", ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-3">Last run</dt>
            <dd className="mt-0.5 text-charcoal">{run ? `${formatDate(run.started_at.slice(0, 10))} · ${run.status.replaceAll("_", " ")}` : "—"}</dd>
          </div>
        </dl>
      </div>
      {data.coverage > 0 && data.coverage < 1 && (
        <p className="mt-3 text-xs text-ink-3">
          Figures describe the classified reviews only. With partial coverage they reflect a sample of this selection.
        </p>
      )}
    </section>
  );
}

export function InsightsCard({ data }: { data: SentimentInsights }) {
  const groups = [
    { title: "Computed from the data", items: data.computed, note: `Comparisons need at least ${data.min_classified} classified reviews per group.` },
    ...(data.ai
      ? [{ title: `AI-written insights · ${data.ai.model}`, items: data.ai.items, note: `Written ${formatDate(data.ai.created_at.slice(0, 10))} from the computed figures only; each cites its evidence.` }]
      : []),
  ];
  return (
    <section aria-labelledby="insights-heading" className="rounded-xl border border-line bg-white p-5 sm:p-6">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-burgundy">Insights</p>
      <h2 id="insights-heading" className="mt-2 text-[15px] font-semibold text-charcoal">
        What the sentiment shows
      </h2>
      {groups.map((g) => (
        <div key={g.title} className="mt-5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-ink-3">{g.title}</h3>
          <p className="mt-0.5 text-xs text-ink-3">{g.note}</p>
          {g.items.length === 0 ? (
            <p className="mt-3 text-sm text-ink-2">Not enough classified reviews for an insight yet.</p>
          ) : (
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {g.items.map((i) => (
                <li key={i.id} className="rounded-lg border border-line p-4">
                  <p className="text-sm font-semibold text-charcoal">{i.title}</p>
                  <p className="mt-1 text-sm text-ink-2">{i.statement}</p>
                  <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2 text-[11px]">
                    {i.evidence.map((e) => (
                      <div key={e.label} className="flex gap-1">
                        <dt className="text-ink-3">{e.label}:</dt>
                        <dd className="tabular-nums text-charcoal">{e.value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}
