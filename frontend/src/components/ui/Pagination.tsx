"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatInteger } from "@/lib/format";
import { useNavigationTransition } from "@/components/layout/NavigationTransition";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  /** The current query string (without "?"); only `pageParam` is changed. */
  query: string;
  pageParam?: string;
  noun?: [singular: string, plural: string];
  label?: string;
}

/** Compact page list: first, last, and a window around the current page. */
export function pageWindow(page: number, totalPages: number, radius = 1): (number | "gap")[] {
  const pages = new Set([1, totalPages]);
  for (let p = page - radius; p <= page + radius; p++) if (p >= 1 && p <= totalPages) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  query,
  pageParam = "page",
  noun = ["result", "results"],
  label = "Pagination",
}: PaginationProps) {
  const { setQuery, isPending } = useNavigationTransition();
  if (total === 0) return null;

  const go = (p: number) => {
    const params = new URLSearchParams(query);
    if (p <= 1) params.delete(pageParam);
    else params.set(pageParam, String(p));
    setQuery(params);
  };

  const from = Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);
  const btn =
    "grid h-8 min-w-8 place-items-center rounded-md px-2 text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-ink-3" aria-live="polite">
        {page > totalPages
          ? `Page ${formatInteger(page)} is past the last page`
          : `${formatInteger(from)}–${formatInteger(to)} of ${formatInteger(total)} ${total === 1 ? noun[0] : noun[1]}`}
      </p>
      {totalPages > 1 && (
        <ul className="flex items-center gap-1">
          <li>
            <button
              type="button"
              onClick={() => go(Math.min(page - 1, totalPages))}
              disabled={page <= 1 || isPending}
              aria-label="Previous page"
              className={`${btn} text-ink-2 hover:bg-light-gray hover:text-charcoal`}
            >
              <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
          </li>
          {pageWindow(Math.min(page, totalPages), totalPages).map((p, i) =>
            p === "gap" ? (
              <li key={`gap-${i}`} aria-hidden className="px-1 text-sm text-ink-3">
                …
              </li>
            ) : (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => go(p)}
                  disabled={isPending}
                  aria-current={p === page ? "page" : undefined}
                  aria-label={`Page ${p}`}
                  className={`${btn} ${
                    p === page ? "bg-burgundy font-medium text-white" : "text-ink-2 hover:bg-light-gray hover:text-charcoal"
                  }`}
                >
                  {formatInteger(p)}
                </button>
              </li>
            ),
          )}
          <li>
            <button
              type="button"
              onClick={() => go(page + 1)}
              disabled={page >= totalPages || isPending}
              aria-label="Next page"
              className={`${btn} text-ink-2 hover:bg-light-gray hover:text-charcoal`}
            >
              <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
          </li>
        </ul>
      )}
    </nav>
  );
}
