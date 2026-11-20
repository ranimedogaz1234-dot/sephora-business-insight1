/**
 * Product insights derived ONLY from figures the API returned for this product and its
 * peers (same Skincare subcategory for review figures, same catalogue category for price).
 * Nothing here is generated text about customers: every sentence restates a computed number.
 */
import type { CatalogueCategory, ProductDetail, ReviewCategory } from "@/lib/api/types";
import type { PeriodRow } from "@/lib/aggregate";
import { formatInteger, formatPercent, formatRating, formatUsd } from "@/lib/format";

export type InsightTone = "positive" | "neutral" | "attention";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
}

/** Below this many review records, comparisons are flagged as a small sample. */
export const MIN_SAMPLE = 30;
/** Rating differences smaller than this are reported as "in line". */
export const RATING_TOLERANCE = 0.1;
/** Recommendation-rate differences smaller than this (absolute) are "in line". */
export const RATE_TOLERANCE = 0.03;
/** A 1–2 star share at or above this is flagged. */
export const LOW_RATING_ALERT = 0.15;

export interface InsightInput {
  product: ProductDetail;
  /** Review figures of the product's Skincare subcategory (null if not reviewed). */
  subcategory: ReviewCategory | null;
  /** Catalogue figures of the product's secondary category (null if unavailable). */
  priceGroup: CatalogueCategory | null;
  /** Yearly review counts for this product (aggregateTrend(..., "year")). */
  yearly: Pick<PeriodRow, "period" | "reviewCount">[];
}

export function productInsights({ product, subcategory, priceGroup, yearly }: InsightInput): Insight[] {
  const out: Insight[] = [];
  const s = product.review_stats;
  const n = s.review_record_count;

  if (n > 0 && n < MIN_SAMPLE) {
    out.push({
      id: "sample",
      tone: "neutral",
      title: "Small review sample",
      detail: `Only ${formatInteger(n)} review record${n === 1 ? "" : "s"}, so comparisons with the subcategory are not reported.`,
    });
  }

  if (n >= MIN_SAMPLE && s.average_rating !== null && subcategory) {
    const diff = s.average_rating - subcategory.average_rating;
    const peer = `${subcategory.subcategory} average of ${formatRating(subcategory.average_rating)}`;
    out.push(
      Math.abs(diff) < RATING_TOLERANCE
        ? {
            id: "rating",
            tone: "neutral",
            title: "Rating in line with its subcategory",
            detail: `Average ${formatRating(s.average_rating)} vs the ${peer}.`,
          }
        : {
            id: "rating",
            tone: diff > 0 ? "positive" : "attention",
            title: diff > 0 ? "Rated above its subcategory" : "Rated below its subcategory",
            detail: `Average ${formatRating(s.average_rating)} is ${Math.abs(diff).toFixed(2)} ${
              diff > 0 ? "above" : "below"
            } the ${peer}.`,
          },
    );
  }

  if (n >= MIN_SAMPLE && s.recommendation_rate !== null && subcategory?.recommendation_rate != null) {
    const diff = s.recommendation_rate - subcategory.recommendation_rate;
    const peer = `${formatPercent(subcategory.recommendation_rate)} in ${subcategory.subcategory}`;
    out.push({
      id: "recommend",
      tone: Math.abs(diff) < RATE_TOLERANCE ? "neutral" : diff > 0 ? "positive" : "attention",
      title: "Recommendation rate",
      detail: `${formatPercent(s.recommendation_rate)} of reviewers who answered would recommend it, vs ${peer}.`,
    });
  }

  if (n >= MIN_SAMPLE) {
    const low = s.rating_distribution.filter((b) => b.rating <= 2).reduce((a, b) => a + b.count, 0) / n;
    if (low >= LOW_RATING_ALERT) {
      out.push({
        id: "low",
        tone: "attention",
        title: "Notable share of low ratings",
        detail: `${formatPercent(low)} of review records give 1 or 2 stars.`,
      });
    }
  }

  if (priceGroup && priceGroup.product_count > 1 && priceGroup.median_price_usd > 0) {
    const ratio = product.price_usd / priceGroup.median_price_usd;
    const median = `${formatUsd(priceGroup.median_price_usd)} median of ${formatInteger(
      priceGroup.product_count,
    )} products in ${priceGroup.category}`;
    out.push({
      id: "price",
      tone: "neutral",
      title:
        ratio >= 1.25 ? "Priced above its category" : ratio <= 0.8 ? "Priced below its category" : "Priced near its category median",
      detail: `${formatUsd(product.price_usd)} vs the ${median}.`,
    });
  }

  const active = yearly.filter((p) => p.reviewCount > 0);
  if (n >= MIN_SAMPLE && active.length > 1) {
    const peak = active.reduce((a, p) => (p.reviewCount > a.reviewCount ? p : a));
    out.push({
      id: "peak",
      tone: "neutral",
      title: `Most active year: ${peak.period}`,
      detail: `${formatInteger(peak.reviewCount)} review records (${formatPercent(peak.reviewCount / n)} of its total).`,
    });
  }

  return out;
}
