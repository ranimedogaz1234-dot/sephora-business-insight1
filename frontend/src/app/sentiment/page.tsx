import type { Metadata } from "next";
import { connection } from "next/server";
import { api } from "@/lib/api/client";
import type { FilterOptions } from "@/lib/api/types";
import type { RawSearchParams } from "@/lib/filters";
import { formatDate } from "@/lib/format";
import { settle } from "@/lib/settle";
import { hasSentimentFilters, parseSentimentState, toSentimentFilters } from "@/lib/sentimentState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PendingFrame } from "@/components/layout/NavigationTransition";
import { SentimentBreakdownCard } from "@/components/sentiment/SentimentBreakdownCard";
import { SentimentDonutCard, SentimentTrendCard } from "@/components/sentiment/SentimentCharts";
import { SentimentFilterBar } from "@/components/sentiment/SentimentFilterBar";
import { CoverageStrip, InsightsCard, NotActivated, SyntheticBanner } from "@/components/sentiment/SentimentPanels";
import { ApiUnavailable } from "@/components/ui/ApiUnavailable";
import { SectionError } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "AI Sentiment Analysis · Sephora Business Insight",
  description: "Positive, neutral and negative sentiment in the Skincare review records, classified with Claude.",
};

const HEADER = {
  eyebrow: "AI sentiment analysis",
  title: "How customers feel",
  description:
    "Review text classified as positive, neutral or negative with the Claude API, by brand, subcategory, product and over time. Coverage is always shown next to the results.",
};

export default async function SentimentAnalysis({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await connection();

  let options: FilterOptions;
  try {
    options = await api.filters();
  } catch (e) {
    return <ApiUnavailable {...HEADER} error={e} />;
  }

  const state = parseSentimentState(await searchParams, {
    brands: options.reviews.brands.map((b) => b.name),
    subcategories: options.reviews.subcategories.map((s) => s.name),
    years: options.reviews.years.map((y) => y.year),
  });
  const f = toSentimentFilters(state);
  const summary = await settle(api.sentimentSummary(f));
  const active = summary.ok && summary.value.dataset_classified > 0;

  const [trend, breakdown, insights] = active
    ? await Promise.all([
        settle(api.sentimentTrend(f, state.grain)),
        settle(api.sentimentBreakdown(f, { by: state.by, sortBy: state.sort, minClassified: state.min, limit: 15 })),
        settle(api.sentimentInsights(f)),
      ])
    : [null, null, null];

  return (
    <>
      <PageHeader
        {...HEADER}
        meta={
          <span>
            Reviews {formatDate(options.reviews.date_min)} – {formatDate(options.reviews.date_max)}
            <br className="hidden sm:block" />
            <span className="sm:hidden"> · </span>
            {hasSentimentFilters(state) ? "Filtered view" : "All review records"}
          </span>
        }
        filters={
          active ? (
            <SentimentFilterBar
              state={state}
              subcategories={options.reviews.subcategories}
              brands={options.reviews.brands}
              years={options.reviews.years.map((y) => y.year)}
            />
          ) : undefined
        }
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <PendingFrame>
          {!summary.ok ? (
            <SectionError message={summary.error} />
          ) : !active ? (
            <NotActivated datasetReviews={summary.value.dataset_reviews} />
          ) : (
            <div className="space-y-6">
              {summary.value.synthetic && <SyntheticBanner />}
              <CoverageStrip data={summary.value} />

              <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <SentimentDonutCard data={summary.value} />
                {trend?.ok ? <SentimentTrendCard data={trend.value} state={state} /> : <SectionError message={trend?.error ?? ""} />}
              </div>

              {breakdown?.ok ? (
                <SentimentBreakdownCard data={breakdown.value} state={state} />
              ) : (
                <SectionError message={breakdown?.error ?? ""} />
              )}

              {insights?.ok ? <InsightsCard data={insights.value} /> : <SectionError message={insights?.error ?? ""} />}
            </div>
          )}
        </PendingFrame>
      </main>
    </>
  );
}
