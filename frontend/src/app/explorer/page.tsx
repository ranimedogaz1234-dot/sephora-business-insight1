import type { Metadata } from "next";
import { connection } from "next/server";
import { api } from "@/lib/api/client";
import type { FilterOptions, Page, ProductItem, ReviewItem } from "@/lib/api/types";
import {
  EXPLORER_PAGE_SIZE,
  hasExplorerFilters,
  parseExplorerState,
  toExplorerSearchParams,
  toProductRecordParams,
  toReviewRecordParams,
} from "@/lib/explorerState";
import type { RawSearchParams } from "@/lib/filters";
import { formatInteger } from "@/lib/format";
import { settle, type Settled } from "@/lib/settle";
import { PageHeader } from "@/components/layout/PageHeader";
import { PendingFrame } from "@/components/layout/NavigationTransition";
import { ColumnDictionary, MissingValuesCard } from "@/components/explorer/ColumnDictionary";
import { ExplorerFilters } from "@/components/explorer/ExplorerFilters";
import { QualityChecks } from "@/components/explorer/QualityChecks";
import { ProductRecords, ReviewRecords } from "@/components/explorer/RecordTables";
import { ApiUnavailable } from "@/components/ui/ApiUnavailable";
import { Pagination } from "@/components/ui/Pagination";
import { ScopeTag } from "@/components/ui/ScopeTag";
import { EmptyState, SectionError } from "@/components/ui/States";

export const metadata: Metadata = {
  title: "Data Explorer · Sephora Business Insight",
  description: "The Sephora product and review data: columns, missing values, quality checks and records.",
};

const HEADER = {
  eyebrow: "Data explorer",
  title: "The data behind every figure",
  description:
    "What each table and column contains, how complete it is, how it was cleaned, and the records themselves. Reviewer identifiers are never shown.",
};

export default async function DataExplorer({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  await connection();

  let options: FilterOptions;
  try {
    options = await api.filters();
  } catch (e) {
    return <ApiUnavailable {...HEADER} error={e} />;
  }

  const categories = options.catalogue.primary_categories.map((c) => c.name);
  const subcategories = options.reviews.subcategories.map((s) => s.name);
  const state = parseExplorerState(await searchParams, { categories, subcategories });

  const [profile, records] = await Promise.all([
    settle(api.datasetProfile()),
    state.ds === "products"
      ? (settle(api.products(toProductRecordParams(state))) as Promise<Settled<Page<ProductItem | ReviewItem>>>)
      : (settle(api.reviews(toReviewRecordParams(state))) as Promise<Settled<Page<ProductItem | ReviewItem>>>),
  ]);
  const table = profile.ok ? profile.value.tables.find((t) => t.name === state.ds) : undefined;

  return (
    <>
      <PageHeader
        {...HEADER}
        meta={<span>Source: six CSV files, read and cleaned on the server</span>}
        filters={<ExplorerFilters state={state} categories={categories} subcategories={subcategories} />}
      />

      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <PendingFrame>
          <div className="space-y-6">
            {!profile.ok ? (
              <SectionError message={profile.error} />
            ) : (
              <>
                <section aria-label="Dataset overview" className="grid gap-4 md:grid-cols-2">
                  {profile.value.tables.map((t) => (
                    <div
                      key={t.name}
                      className={`rounded-xl border bg-white p-5 ${t.name === state.ds ? "border-elegant-pink" : "border-line"}`}
                    >
                      <ScopeTag scope={t.name === "products" ? "catalogue" : "reviews"} />
                      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="text-[15px] font-semibold text-charcoal">{t.label}</h2>
                        {t.name === state.ds && <span className="text-[11px] font-medium text-burgundy">Selected</span>}
                      </div>
                      <p className="mt-1 text-sm text-ink-2">{t.description}</p>
                      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
                        <div>
                          <dt className="text-xs text-ink-3">Rows</dt>
                          <dd className="mt-0.5 text-xl font-semibold tabular-nums text-burgundy">{formatInteger(t.row_count)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-ink-3">Columns</dt>
                          <dd className="mt-0.5 text-xl font-semibold tabular-nums text-burgundy">{t.columns.length}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-ink-3">Source</dt>
                          <dd className="mt-0.5 break-words font-mono text-[12px] text-ink-2">{t.source}</dd>
                        </div>
                      </dl>
                    </div>
                  ))}
                </section>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                  <QualityChecks checks={profile.value.checks} />
                  {table && <MissingValuesCard table={table} />}
                </div>

                {table && <ColumnDictionary table={table} />}
              </>
            )}

            <section aria-labelledby="records-heading" className="rounded-xl border border-line bg-white p-5 sm:p-6">
              <ScopeTag scope={state.ds === "products" ? "catalogue" : "reviews"} />
              <h2 id="records-heading" className="mt-2 text-[15px] font-semibold text-charcoal">
                {state.ds === "products" ? "Product records" : "Review records"}
                {records.ok && (
                  <span className="font-normal text-ink-3">
                    {" "}
                    · {formatInteger(records.value.total)} {hasExplorerFilters(state) ? "match" : "in total"}
                  </span>
                )}
              </h2>
              <p className="mb-4 mt-0.5 text-xs text-ink-3">
                Searching, filtering, sorting and paging run on the server, {EXPLORER_PAGE_SIZE} rows at a time.
                {state.ds === "reviews" ? " Only the review title is shown here; open Review Analytics for full text." : ""}
              </p>
              {!records.ok ? (
                <SectionError message={records.error} />
              ) : records.value.total === 0 ? (
                <EmptyState message="No records match these filters." />
              ) : records.value.items.length === 0 ? (
                <EmptyState message="This page is past the end of the results." />
              ) : state.ds === "products" ? (
                <ProductRecords items={records.value.items as ProductItem[]} />
              ) : (
                <ReviewRecords items={records.value.items as ReviewItem[]} />
              )}
              {records.ok && (
                <div className="mt-4">
                  <Pagination
                    page={state.page}
                    totalPages={records.value.total_pages}
                    total={records.value.total}
                    pageSize={EXPLORER_PAGE_SIZE}
                    query={toExplorerSearchParams(state).toString()}
                    noun={["record", "records"]}
                    label="Record pages"
                  />
                </div>
              )}
            </section>
          </div>
        </PendingFrame>
      </main>
    </>
  );
}
