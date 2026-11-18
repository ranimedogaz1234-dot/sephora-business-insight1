import { connection } from "next/server";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { api } from "@/lib/api/client";
import type { HealthResponse, OverviewResponse } from "@/lib/api/types";
import { config } from "@/lib/config";
import {
  formatCompact,
  formatInteger,
  formatMonthYear,
  formatPercent,
  formatRating,
} from "@/lib/format";

async function load(): Promise<{
  health: HealthResponse | null;
  overview: OverviewResponse | null;
  error: string | null;
}> {
  let health: HealthResponse;
  try {
    health = await api.health();
  } catch (e) {
    return {
      health: null,
      overview: null,
      error: `Cannot reach the API at ${config.apiBaseUrl} (${(e as Error).message}).`,
    };
  }
  if (!health.dataset_available) {
    return {
      health,
      overview: null,
      error: "The API is running but cannot find the CSV files. Check SBI_DATA_DIR in backend/.env.",
    };
  }
  try {
    return { health, overview: await api.overview(), error: null };
  } catch (e) {
    return { health, overview: null, error: `Overview request failed: ${(e as Error).message}` };
  }
}

function datasetLabel(health: HealthResponse | null): string {
  if (!health) return "Dataset status unknown";
  return health.dataset_available ? "Dataset found" : "Dataset missing";
}

export default async function OverviewPage() {
  await connection(); // always render with live backend data
  const { health, overview, error } = await load();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-elegant-pink">Project setup</p>
          <h1 className="font-display text-3xl text-charcoal md:text-4xl">Dataset Overview</h1>
        </div>
        <div className="flex gap-2">
          <StatusBadge ok={!!health} label={health ? "API connected" : "API offline"} />
          <StatusBadge ok={!!health?.dataset_available} label={datasetLabel(health)} />
        </div>
      </header>

      {error && (
        <Card>
          <p className="text-sm text-burgundy">{error}</p>
          <p className="mt-1 text-xs text-charcoal/60">
            Start the backend (see README) and check the environment configuration.
          </p>
        </Card>
      )}

      {overview && (
        <>
          <section aria-labelledby="catalogue-heading" className="space-y-3">
            <h2 id="catalogue-heading" className="text-sm font-semibold text-charcoal/70">
              Product catalogue · product_info.csv
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Products" value={formatInteger(overview.catalogue.total_products)} />
              <KpiCard label="Brands" value={formatInteger(overview.catalogue.total_brands)} />
              <KpiCard
                label="Categories"
                value={formatInteger(overview.catalogue.total_categories)}
              />
              <KpiCard
                label="Sephora-listed reviews"
                value={formatCompact(overview.catalogue.sephora_listed_review_count)}
                source="Catalogue count, not review records"
              />
            </div>
          </section>

          <section aria-labelledby="reviews-heading" className="space-y-3">
            <h2 id="reviews-heading" className="text-sm font-semibold text-charcoal/70">
              Review records · {overview.reviews.review_scope_category ?? "all"} products
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Reviews"
                value={formatInteger(overview.reviews.review_count)}
                source={`${formatInteger(overview.reviews.duplicate_reviews_removed)} exact duplicates removed`}
              />
              <KpiCard
                label="Average rating"
                value={formatRating(overview.reviews.average_rating)}
              />
              <KpiCard
                label="Five-star share"
                value={formatPercent(overview.reviews.five_star_share)}
              />
              <KpiCard
                label="Reviewed products"
                value={formatInteger(overview.reviews.reviewed_products)}
                source={`${formatMonthYear(overview.reviews.first_review_date)} – ${formatMonthYear(overview.reviews.last_review_date)}`}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
