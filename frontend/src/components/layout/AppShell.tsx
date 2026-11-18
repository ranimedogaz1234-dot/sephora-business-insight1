import Link from "next/link";
import type { ReactNode } from "react";
import { NAV_ITEMS } from "@/lib/navigation";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-soft-pink bg-white md:w-64 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-6 py-5">
          <p className="font-display text-xl tracking-wide text-burgundy">Sephora</p>
          <p className="text-xs uppercase tracking-[0.2em] text-charcoal/60">Business Insight</p>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-6">
          {NAV_ITEMS.map((item) =>
            item.ready ? (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-md bg-soft-pink px-3 py-2 text-sm font-medium text-burgundy"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.href}
                aria-disabled="true"
                title="Coming in a later part"
                className="whitespace-nowrap rounded-md px-3 py-2 text-sm text-charcoal/40"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-10 md:py-10">{children}</main>
    </div>
  );
}
