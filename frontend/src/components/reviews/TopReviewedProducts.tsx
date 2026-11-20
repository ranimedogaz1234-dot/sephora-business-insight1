import Link from "next/link";
import type { RankedProduct } from "@/lib/api/types";
import { formatInteger, formatRating, formatUsd } from "@/lib/format";
import { reviewHref, type ReviewPageState } from "@/lib/reviewFilters";
import { ScopeTag } from "@/components/ui/ScopeTag";
import { EmptyState } from "@/components/ui/States";

/** Product-level exploration: the most reviewed products in the current selection. */
export function TopReviewedProducts({ items, state }: { items: RankedProduct[]; state: ReviewPageState }) {
  return (
    <section
      aria-labelledby="top-products-heading"
      className="min-w-0 rounded-xl border border-line bg-white p-5 transition-colors hover:border-line-strong sm:p-6"
    >
      <ScopeTag scope="reviews" />
      <h2 id="top-products-heading" className="mt-2 text-[15px] font-semibold text-charcoal">
        Most reviewed products
      </h2>
      <p className="mt-0.5 text-xs text-ink-3">
        Ranked by review records in the current selection. Open a product, or narrow every chart to it.
      </p>

      <div className="mt-5">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <caption className="sr-only">Most reviewed products in the current selection</caption>
              <thead className="border-b border-line text-[11px] font-medium uppercase tracking-wide text-ink-3">
                <tr>
                  <th scope="col" className="w-8 py-2 pr-2 text-right font-medium">#</th>
                  <th scope="col" className="px-3 py-2 font-medium">Product</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Price</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Reviews</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Avg rating</th>
                  <th scope="col" className="py-2 pl-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((p) => (
                  <tr key={p.product_id} className="transition-colors hover:bg-soft-pink/40">
                    <td className="py-2.5 pr-2 text-right text-xs tabular-nums text-ink-3">{p.rank}</td>
                    <td className="max-w-[18rem] px-3 py-2.5">
                      <Link
                        href={`/products/${encodeURIComponent(p.product_id)}`}
                        className="block truncate font-medium text-charcoal hover:text-burgundy hover:underline"
                        title={p.product_name}
                      >
                        {p.product_name}
                      </Link>
                      <p className="truncate text-xs text-ink-3">
                        {p.brand_name}
                        {p.subcategory && ` · ${p.subcategory}`}
                      </p>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{formatUsd(p.price_usd)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-charcoal">
                      {formatInteger(p.review_count)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-2">{formatRating(p.average_rating)}</td>
                    <td className="py-2.5 pl-3 text-right">
                      {state.product === p.product_id ? (
                        <span className="text-xs text-ink-3">Selected</span>
                      ) : (
                        <Link
                          href={reviewHref(state, { product: p.product_id })}
                          scroll={false}
                          aria-label={`Explore reviews of ${p.product_name}`}
                          className="whitespace-nowrap text-xs font-medium text-burgundy hover:underline"
                        >
                          Explore reviews
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
