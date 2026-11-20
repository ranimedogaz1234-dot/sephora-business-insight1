import Link from "next/link";
import type { ProductItem, ReviewItem } from "@/lib/api/types";
import { formatCompact, formatDate, formatInteger, formatRating, formatUsd } from "@/lib/format";

const th = "whitespace-nowrap px-3 py-2.5 font-medium";
const td = "whitespace-nowrap px-3 py-2 tabular-nums";
const dash = <span className="text-ink-3">—</span>;

/** Catalogue rows as stored (selected columns), with links to the product page. */
export function ProductRecords({ items }: { items: ProductItem[] }) {
  return (
    <div className="relative overflow-x-auto rounded-lg border border-line" tabIndex={0} aria-label="Product records, scrollable">
      <table className="w-full min-w-[1000px] text-left text-[13px]">
        <caption className="sr-only">Product catalogue records</caption>
        <thead className="bg-light-gray font-mono text-[11px] text-ink-3">
          <tr>
            <th scope="col" className={th}>product_id</th>
            <th scope="col" className={th}>product_name</th>
            <th scope="col" className={th}>brand_name</th>
            <th scope="col" className={th}>primary_category</th>
            <th scope="col" className={th}>secondary_category</th>
            <th scope="col" className={`${th} text-right`}>price_usd</th>
            <th scope="col" className={`${th} text-right`}>rating</th>
            <th scope="col" className={`${th} text-right`}>reviews</th>
            <th scope="col" className={`${th} text-right`}>loves_count</th>
            <th scope="col" className={`${th} text-right`} title="Rows in the review files (Skincare only)">
              review records
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((p) => (
            <tr key={p.product_id} className="hover:bg-soft-pink/40">
              <td className={`${td} font-mono text-ink-2`}>{p.product_id}</td>
              <td className="max-w-[16rem] truncate px-3 py-2" title={p.product_name}>
                <Link href={`/products/${encodeURIComponent(p.product_id)}`} className="text-charcoal hover:text-burgundy hover:underline">
                  {p.product_name}
                </Link>
              </td>
              <td className={`${td} text-ink-2`}>{p.brand_name}</td>
              <td className={`${td} text-ink-2`}>{p.primary_category}</td>
              <td className={`${td} text-ink-2`}>{p.secondary_category ?? dash}</td>
              <td className={`${td} text-right`}>{formatUsd(p.price_usd)}</td>
              <td className={`${td} text-right`}>{p.catalogue_rating === null ? dash : formatRating(p.catalogue_rating)}</td>
              <td className={`${td} text-right`}>{p.sephora_review_count === null ? dash : formatInteger(p.sephora_review_count)}</td>
              <td className={`${td} text-right`}>{formatCompact(p.loves_count)}</td>
              <td className={`${td} text-right`}>{p.review_record_count ? formatInteger(p.review_record_count) : dash}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Review rows (selected columns). The reviewer identifier is never included. */
export function ReviewRecords({ items }: { items: ReviewItem[] }) {
  return (
    <div className="relative overflow-x-auto rounded-lg border border-line" tabIndex={0} aria-label="Review records, scrollable">
      <table className="w-full min-w-[1000px] text-left text-[13px]">
        <caption className="sr-only">Review records</caption>
        <thead className="bg-light-gray font-mono text-[11px] text-ink-3">
          <tr>
            <th scope="col" className={th}>submission_time</th>
            <th scope="col" className={th}>product_id</th>
            <th scope="col" className={th}>brand_name</th>
            <th scope="col" className={th}>subcategory</th>
            <th scope="col" className={`${th} text-right`}>rating</th>
            <th scope="col" className={th}>is_recommended</th>
            <th scope="col" className={`${th} text-right`}>helpful votes</th>
            <th scope="col" className={th}>skin_type</th>
            <th scope="col" className={th}>review_title</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((r) => (
            <tr key={r.review_id} className="hover:bg-soft-pink/40">
              <td className={`${td} text-ink-2`}>
                <time dateTime={r.submission_date}>{formatDate(r.submission_date)}</time>
              </td>
              <td className={`${td} font-mono`}>
                <Link
                  href={`/products/${encodeURIComponent(r.product_id)}`}
                  title={r.product_name}
                  className="text-charcoal hover:text-burgundy hover:underline"
                >
                  {r.product_id}
                </Link>
              </td>
              <td className={`${td} text-ink-2`}>{r.brand_name}</td>
              <td className={`${td} text-ink-2`}>{r.subcategory ?? dash}</td>
              <td className={`${td} text-right`}>{r.rating}</td>
              <td className={`${td} text-ink-2`}>{r.is_recommended === null ? dash : r.is_recommended ? "Yes" : "No"}</td>
              <td className={`${td} text-right`}>
                {r.total_feedback_count ? `${formatInteger(r.total_pos_feedback_count)} / ${formatInteger(r.total_feedback_count)}` : dash}
              </td>
              <td className={`${td} text-ink-2`}>{r.skin_type ?? dash}</td>
              <td className="max-w-[18rem] truncate px-3 py-2 text-charcoal" title={r.review_title ?? undefined}>
                {r.review_title ?? dash}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
