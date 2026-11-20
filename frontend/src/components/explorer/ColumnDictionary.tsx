import type { ColumnProfile, TableProfile } from "@/lib/api/types";
import { formatDate, formatInteger, formatPercent } from "@/lib/format";
import { RankedBarList } from "@/components/charts/RankedBarList";
import { ChartCard } from "@/components/ui/ChartCard";

const KIND_LABEL: Record<ColumnProfile["kind"], string> = {
  identifier: "ID",
  text: "Text",
  category: "Category",
  number: "Number",
  boolean: "Yes / no",
  date: "Date",
};

const num = (n: number) => (Number.isInteger(n) ? formatInteger(n) : n.toLocaleString("en-US", { maximumFractionDigits: 2 }));

/** One-line summary of a column's values, by kind. */
export function columnSummary(c: ColumnProfile): string {
  if (!c.exposed) return "Withheld";
  if (c.kind === "number" && c.min !== null && c.max !== null) {
    return `${num(c.min)} – ${num(c.max)} · median ${c.median === null ? "—" : num(c.median)}`;
  }
  if (c.kind === "date" && c.date_min && c.date_max) return `${formatDate(c.date_min)} – ${formatDate(c.date_max)}`;
  if (c.kind === "text" && c.median_length !== null) return `Median ${formatInteger(c.median_length)} characters`;
  if (c.distinct !== null) return `${formatInteger(c.distinct)} distinct`;
  return "—";
}

export function MissingValuesCard({ table }: { table: TableProfile }) {
  const missing = table.columns
    .filter((c) => c.exposed && (c.missing ?? 0) > 0)
    .sort((a, b) => (b.missing_share ?? 0) - (a.missing_share ?? 0) || a.name.localeCompare(b.name));
  const complete = table.columns.filter((c) => c.exposed && c.missing === 0).length;

  return (
    <ChartCard
      title="Missing values by column"
      subtitle={`${table.label}: ${missing.length} of ${table.columns.filter((c) => c.exposed).length} columns have gaps; ${complete} are complete`}
      scope={table.name === "products" ? "catalogue" : "reviews"}
    >
      {missing.length === 0 ? (
        <p className="rounded-lg bg-light-gray px-6 py-10 text-center text-sm text-ink-2">No missing values in this table.</p>
      ) : (
        <RankedBarList
          ariaLabel={`Missing values by column, ${table.label}`}
          ranked={false}
          max={1}
          items={missing.map((c) => ({
            key: c.name,
            label: c.name,
            value: c.missing_share ?? 0,
            display: formatPercent(c.missing_share ?? 0),
            secondary: `${formatInteger(c.missing ?? 0)} rows`,
          }))}
        />
      )}
    </ChartCard>
  );
}

export function ColumnDictionary({ table }: { table: TableProfile }) {
  const dropped = Object.entries(table.dropped_columns);
  return (
    <section aria-labelledby="dictionary-heading" className="min-w-0 rounded-xl border border-line bg-white p-5 sm:p-6">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-3">Column dictionary</p>
      <h2 id="dictionary-heading" className="mt-2 text-[15px] font-semibold text-charcoal">
        {table.label} · {table.columns.length} columns
      </h2>
      <p className="mt-0.5 text-xs text-ink-3">
        Source: {table.source}. Names are the original CSV column names; figures cover all{" "}
        {formatInteger(table.row_count)} rows.
      </p>

      <div className="relative mt-4 overflow-x-auto rounded-lg border border-line" tabIndex={0} aria-label="Column dictionary, scrollable">
        <table className="w-full min-w-[820px] text-left text-sm">
          <caption className="sr-only">{table.label} column dictionary</caption>
          <thead className="bg-light-gray text-[11px] font-medium uppercase tracking-wide text-ink-3">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Column</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Description</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Present</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Missing</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Values</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {table.columns.map((c) => (
              <tr key={c.name} className={`align-top ${c.exposed ? "" : "bg-light-gray/60"}`}>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12.5px] text-charcoal">{c.name}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">{KIND_LABEL[c.kind]}</td>
                <td className="px-4 py-2.5 text-ink-2">{c.description}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-ink-2">
                  {c.non_null === null ? "—" : formatInteger(c.non_null)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                  {c.missing === null ? (
                    <span className="text-ink-3">—</span>
                  ) : c.missing === 0 ? (
                    <span className="text-ink-3">0</span>
                  ) : (
                    <span className="text-charcoal">
                      {formatInteger(c.missing)} <span className="text-ink-3">({formatPercent(c.missing_share ?? 0)})</span>
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">{columnSummary(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dropped.length > 0 && (
        <div className="mt-4 text-xs text-ink-3">
          <p className="font-medium text-ink-2">Source columns not kept</p>
          <ul className="mt-1 space-y-0.5">
            {dropped.map(([name, why]) => (
              <li key={name}>
                <span className="font-mono text-charcoal">{name}</span>: {why}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
