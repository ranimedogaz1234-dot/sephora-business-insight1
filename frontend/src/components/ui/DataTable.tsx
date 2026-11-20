export interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}

export type TableRow = Record<string, string | number>;

interface DataTableProps {
  caption: string;
  columns: TableColumn[];
  rows: TableRow[];
  maxHeight?: number;
}

/** Accessible table view — the WCAG-clean twin of every chart. */
export function DataTable({ caption, columns, rows, maxHeight = 320 }: DataTableProps) {
  return (
    <div className="relative overflow-auto rounded-md border border-line" style={{ maxHeight }} tabIndex={0}>
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-light-gray">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`whitespace-nowrap px-3 py-2 text-xs font-medium text-ink-2 ${
                  c.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-line">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-1.5 text-charcoal ${
                    c.align === "right" ? "text-right tabular-nums" : "text-left"
                  }`}
                >
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
