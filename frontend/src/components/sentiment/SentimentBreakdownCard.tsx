"use client";

import Link from "next/link";
import type { SentimentBreakdown, SentimentDimension } from "@/lib/api/types";
import { formatInteger, formatPercent } from "@/lib/format";
import {
  DIMENSIONS,
  MIN_CLASSIFIED_OPTIONS,
  SORTS,
  toSentimentSearchParams,
  type SentimentState,
} from "@/lib/sentimentState";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";
import { ScopeTag } from "@/components/ui/ScopeTag";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/States";
import { SentimentBar, SentimentLegend } from "./SentimentBar";

const DIM_LABEL: Record<SentimentDimension, string> = { brand: "Brand", subcategory: "Subcategory", product: "Product" };

function href(by: SentimentDimension, key: string): string | null {
  if (by === "product") return `/products/${encodeURIComponent(key)}`;
  if (by === "brand") return `/brands?${new URLSearchParams({ brand: key })}#brand-focus`;
  return null;
}

export function SentimentBreakdownCard({ data, state }: { data: SentimentBreakdown; state: SentimentState }) {
  const { setQuery } = useNavigationTransition();
  const change = (c: Partial<SentimentState>) => setQuery(toSentimentSearchParams({ ...state, ...c }));
  return (
    <section aria-labelledby="breakdown-heading" className="rounded-xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <ScopeTag scope="reviews" />
          <h2 id="breakdown-heading" className="mt-2 text-[15px] font-semibold text-charcoal">
            Sentiment by {DIM_LABEL[data.by].toLowerCase()}
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">
            {formatInteger(data.groups_total)} {data.by === "subcategory" ? "subcategories" : `${data.by}s`} with at least{" "}
            {formatInteger(data.min_classified)} classified reviews · showing {data.items.length}
          </p>
        </div>
        <SentimentLegend />
      </div>

      <div className="mt-4 grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap" role="group" aria-label="Breakdown options">
        <div role="group" aria-label="Break down by" className="col-span-2 flex rounded-md border border-line p-0.5 sm:col-span-1">
          {DIMENSIONS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={state.by === d}
              onClick={() => change({ by: d })}
              className={`h-8 flex-1 rounded px-3 text-sm transition-colors sm:flex-none ${
                state.by === d ? "bg-soft-pink font-medium text-burgundy" : "text-ink-2 hover:text-charcoal"
              }`}
            >
              {DIM_LABEL[d]}
            </button>
          ))}
        </div>
        <Select label="Sort by" value={state.sort} onChange={(v) => change({ sort: v as SentimentState["sort"] })} width="sm:w-52">
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <Select label="Minimum classified" value={String(state.min)} onChange={(v) => change({ min: Number(v) })} width="sm:w-40">
          {MIN_CLASSIFIED_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {formatInteger(n)}+ reviews
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-5">
        {data.items.length === 0 ? (
          <EmptyState message={`No ${data.by} has ${formatInteger(data.min_classified)}+ classified reviews in this selection. Lower the minimum.`} />
        ) : (
          <ol className="divide-y divide-line">
            {data.items.map((g) => {
              const link = href(data.by, g.key);
              return (
                <li key={g.key} className="grid gap-x-6 gap-y-2 py-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-charcoal" title={g.name}>
                      {link ? (
                        <Link href={link} className="hover:text-burgundy hover:underline">
                          {g.name}
                        </Link>
                      ) : (
                        g.name
                      )}
                    </p>
                    <p className="text-xs text-ink-3">
                      {g.brand_name ? `${g.brand_name} · ` : ""}
                      {formatInteger(g.classified)} classified
                    </p>
                  </div>
                  <SentimentBar shares={{ positive: g.positive_share, neutral: g.neutral_share, negative: g.negative_share }} />
                  <dl className="flex gap-4 text-right text-xs tabular-nums md:w-56 md:justify-end">
                    <div>
                      <dt className="text-ink-3">Positive</dt>
                      <dd className="font-medium text-charcoal">{formatPercent(g.positive_share)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3">Negative</dt>
                      <dd className="font-medium text-charcoal">{formatPercent(g.negative_share)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-3" title="Positive share minus negative share">Net</dt>
                      <dd className="font-medium text-charcoal">
                        {g.net > 0 ? "+" : ""}
                        {(g.net * 100).toFixed(1)}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
