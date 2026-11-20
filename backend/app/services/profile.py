"""Dataset profile for the Data Explorer: column dictionary, missing values, quality checks.

Every figure is computed from the loaded data; only column descriptions are written by hand.
Columns are reported under their original CSV names, except the reviewer identifier, which is
listed under a neutral label as withheld: no statistics or values are returned for it.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from app.data.dataset import Dataset
from app.data.loader import PRODUCT_FILE
from app.schemas.responses import ColumnProfile, DatasetProfile, QualityCheck, TableProfile
from app.services.common import REVIEW_SCOPE_CATEGORY, r4, to_date


@dataclass(frozen=True)
class ColumnSpec:
    name: str  # original CSV column name
    source: str | None  # prepared column, or None when withheld
    kind: str  # identifier | text | category | number | boolean | date
    description: str
    text_table: bool = False  # lives in ds.review_texts


PRODUCT_COLUMNS = [
    ColumnSpec("product_id", "product_id", "identifier", "Sephora product identifier."),
    ColumnSpec("product_name", "product_name", "text", "Product name as listed."),
    ColumnSpec("brand_id", "brand_id", "identifier", "Sephora brand identifier."),
    ColumnSpec("brand_name", "brand_name", "category", "Brand name."),
    ColumnSpec(
        "loves_count", "loves_count", "number", "Times shoppers marked the product as a favourite."
    ),
    ColumnSpec(
        "rating", "catalogue_rating", "number", "Sephora's average rating for the product (1–5)."
    ),
    ColumnSpec(
        "reviews",
        "sephora_review_count",
        "number",
        "Sephora's own review count. Not the same as the review records in the review files.",
    ),
    ColumnSpec("size", "size", "text", "Pack size as listed, e.g. '1.7 oz / 50 mL'."),
    ColumnSpec(
        "variation_type", "variation_type", "text", "What the variants differ by (size, colour…)."
    ),
    ColumnSpec(
        "variation_value", "variation_value", "text", "Value of the variation for this listing."
    ),
    ColumnSpec(
        "variation_desc", "variation_desc", "text", "Free-text description of the variation."
    ),
    ColumnSpec("ingredients", "ingredients", "text", "Ingredient list(s) as published."),
    ColumnSpec("price_usd", "price_usd", "number", "List price in US dollars."),
    ColumnSpec(
        "value_price_usd", "value_price_usd", "number", "Stated value price, for sets and kits."
    ),
    ColumnSpec(
        "sale_price_usd", "sale_price_usd", "number", "Sale price in US dollars, when on sale."
    ),
    ColumnSpec("limited_edition", "limited_edition", "boolean", "Limited-edition flag."),
    ColumnSpec("new", "new", "boolean", "New-arrival flag."),
    ColumnSpec("online_only", "online_only", "boolean", "Sold online only."),
    ColumnSpec(
        "out_of_stock", "out_of_stock", "boolean", "Out of stock when the data was collected."
    ),
    ColumnSpec("sephora_exclusive", "sephora_exclusive", "boolean", "Sold exclusively at Sephora."),
    ColumnSpec("highlights", "highlights", "text", "Marketing highlight tags."),
    ColumnSpec(
        "primary_category", "primary_category", "category", "Top-level category (nine in total)."
    ),
    ColumnSpec("secondary_category", "secondary_category", "category", "Second-level category."),
    ColumnSpec("tertiary_category", "tertiary_category", "category", "Third-level category."),
    ColumnSpec("child_count", "child_count", "number", "Number of variants (child listings)."),
    ColumnSpec(
        "child_max_price", "child_max_price", "number", "Highest variant price in US dollars."
    ),
    ColumnSpec(
        "child_min_price", "child_min_price", "number", "Lowest variant price in US dollars."
    ),
]

REVIEW_COLUMNS = [
    ColumnSpec(
        # Listed under a neutral label: the API never echoes the source field name.
        "reviewer_id (withheld)",
        None,
        "identifier",
        "Pseudonymous reviewer identifier. Withheld: used only to count distinct reviewers, "
        "never returned.",
    ),
    ColumnSpec("rating", "rating", "number", "Star rating given by the reviewer (1–5)."),
    ColumnSpec(
        "is_recommended",
        "is_recommended",
        "boolean",
        "Whether the reviewer recommends the product.",
    ),
    ColumnSpec(
        "helpfulness",
        "helpfulness",
        "number",
        "Share of feedback votes that found the review helpful (positive ÷ total).",
    ),
    ColumnSpec(
        "total_feedback_count", "total_feedback_count", "number", "Helpfulness votes received."
    ),
    ColumnSpec(
        "total_neg_feedback_count", "total_neg_feedback_count", "number", "'Not helpful' votes."
    ),
    ColumnSpec(
        "total_pos_feedback_count", "total_pos_feedback_count", "number", "'Helpful' votes."
    ),
    ColumnSpec("submission_time", "submission_time", "date", "Date the review was submitted."),
    ColumnSpec("review_text", "review_text", "text", "Review body as written.", text_table=True),
    ColumnSpec(
        "review_title", "review_title", "text", "Review headline as written.", text_table=True
    ),
    ColumnSpec("skin_tone", "skin_tone", "category", "Self-reported skin tone."),
    ColumnSpec("eye_color", "eye_color", "category", "Self-reported eye colour."),
    ColumnSpec("skin_type", "skin_type", "category", "Self-reported skin type."),
    ColumnSpec("hair_color", "hair_color", "category", "Self-reported hair colour."),
    ColumnSpec(
        "product_id", "product_id", "identifier", "Reviewed product; joins to the catalogue."
    ),
    ColumnSpec("brand_name", "brand_name", "category", "Brand of the reviewed product."),
]

DROPPED_REVIEW_COLUMNS = {
    "Unnamed: 0": "Per-file row counter added by the CSV export; not part of the review.",
    "product_name": "Identical to the catalogue for every reviewed product; joined from there.",
    "price_usd": "Identical to the catalogue for every reviewed product; joined from there.",
}


def _missing(series: pd.Series) -> pd.Series:
    """Missing values, counting the literal 'nan' labels categorical columns carry for NaN.

    Categorical columns are checked through their small category list and integer codes,
    instead of converting a million values to strings."""
    if isinstance(series.dtype, pd.CategoricalDtype):
        cats = series.cat.categories.astype(str)
        nan_codes = np.flatnonzero(cats == "nan")
        codes = series.cat.codes.to_numpy()
        miss = (codes < 0) | np.isin(codes, nan_codes)
    else:
        miss = series.isna().to_numpy()
    return pd.Series(np.asarray(miss, dtype=bool), index=series.index)


def _distinct(present: pd.Series) -> int:
    if isinstance(present.dtype, pd.CategoricalDtype):
        return int(len(np.unique(present.cat.codes.to_numpy())))
    return int(present.astype("string").nunique())


def _column(spec: ColumnSpec, frame: pd.DataFrame, n: int) -> ColumnProfile:
    base = dict(name=spec.name, kind=spec.kind, description=spec.description)
    if spec.source is None:
        return ColumnProfile(**base, exposed=False, non_null=None, missing=None, missing_share=None)
    s = frame[spec.source]
    miss = _missing(s)
    present = s[~miss.to_numpy()]
    missing = int(miss.sum())
    out = ColumnProfile(
        **base,
        exposed=True,
        non_null=n - missing,
        missing=missing,
        missing_share=r4(missing / n) if n else 0.0,
    )
    if spec.kind in ("category", "identifier", "boolean"):
        out.distinct = _distinct(present)
    elif spec.kind == "number" and len(present):
        values = present.astype("float64")
        out.min, out.max = r4(values.min()), r4(values.max())
        out.mean, out.median = r4(values.mean()), r4(values.median())
    elif spec.kind == "date" and len(present):
        out.date_min, out.date_max = to_date(present.min()), to_date(present.max())
    elif spec.kind == "text" and len(present):
        out.median_length = int(present.astype("string").str.len().median())
    return out


def _check(name: str, ok: bool | None, value: str, detail: str) -> QualityCheck:
    status = "info" if ok is None else ("pass" if ok else "warn")
    return QualityCheck(name=name, status=status, value=value, detail=detail)


def _pct(part: int, whole: int) -> str:
    return f"{part / whole:.1%}" if whole else "—"


def dataset_profile(ds: Dataset) -> DatasetProfile:
    def compute() -> DatasetProfile:
        p, r = ds.products, ds.reviews
        texts = ds.review_texts
        review_frame = pd.concat([r, texts], axis=1)
        n_p, n_r = len(p), len(r)

        tables = [
            TableProfile(
                name="products",
                label="Product catalogue",
                source=PRODUCT_FILE,
                description=(
                    "One row per product across all nine categories, with Sephora's catalogue "
                    "rating, review count, price and flags."
                ),
                row_count=n_p,
                columns=[_column(c, p, n_p) for c in PRODUCT_COLUMNS],
                dropped_columns={},
            ),
            TableProfile(
                name="reviews",
                label="Review records",
                source=", ".join(ds.review_files),
                description=(
                    f"One row per customer review of {REVIEW_SCOPE_CATEGORY} products, after "
                    "removing exact duplicate copies."
                ),
                row_count=n_r,
                columns=[_column(c, review_frame, n_r) for c in REVIEW_COLUMNS],
                dropped_columns=DROPPED_REVIEW_COLUMNS,
            ),
        ]

        catalogue_ids = set(p["product_id"].astype(str))
        review_ids = r["product_id"].astype(str)
        unlinked = int((~review_ids.isin(catalogue_ids)).sum())
        ratings = r["rating"].to_numpy()
        bad_ratings = int(((ratings < 1) | (ratings > 5)).sum())
        no_date = int(r["submission_time"].isna().sum())
        scope_ids = set(
            p.loc[(p["primary_category"] == REVIEW_SCOPE_CATEGORY).to_numpy(), "product_id"].astype(
                str
            )
        )
        in_scope = int(review_ids.isin(scope_ids).sum())
        reviewed_products = int(r["product_id"].nunique())
        scope_reviewed = len(scope_ids & set(review_ids.unique()))
        no_price = int(p["price_usd"].isna().sum())
        answered = int(r["is_recommended"].notna().sum())
        with_text = int(texts["review_text"].notna().sum())

        checks = [
            _check(
                "Exact duplicate reviews removed",
                None,
                f"{ds.duplicate_reviews_removed:,} of {ds.raw_review_count:,} raw rows",
                "Only rows identical in every field are removed; near-duplicates are kept.",
            ),
            _check(
                "Ratings within 1–5",
                bad_ratings == 0,
                f"{bad_ratings:,} out of range",
                "Every review rating should be a whole star from 1 to 5.",
            ),
            _check(
                "Review dates parsed",
                no_date == 0,
                f"{no_date:,} unparseable",
                "Submission dates that could not be read as dates.",
            ),
            _check(
                "Reviews linked to catalogue products",
                unlinked == 0,
                f"{_pct(n_r - unlinked, n_r)} linked",
                f"{unlinked:,} review records point to a product missing from {PRODUCT_FILE}.",
            ),
            _check(
                f"Reviews in the {REVIEW_SCOPE_CATEGORY} scope",
                in_scope == n_r,
                f"{_pct(in_scope, n_r)} of review records",
                f"Review analytics assume every review is of a {REVIEW_SCOPE_CATEGORY} product.",
            ),
            _check(
                f"{REVIEW_SCOPE_CATEGORY} products with review records",
                None,
                f"{scope_reviewed:,} of {len(scope_ids):,} "
                f"({_pct(scope_reviewed, len(scope_ids))})",
                f"{reviewed_products:,} products have at least one review record.",
            ),
            _check(
                "Catalogue prices present",
                no_price == 0,
                f"{no_price:,} missing",
                "Products without a list price are excluded from price statistics.",
            ),
            _check(
                "Recommendation answered",
                None,
                f"{_pct(answered, n_r)} of review records",
                "Recommend rates are computed only over reviews that answered.",
            ),
            _check(
                "Reviews with text",
                None,
                f"{_pct(with_text, n_r)} of review records",
                "Reviews without a body still count in ratings and volumes.",
            ),
        ]
        return DatasetProfile(tables=tables, checks=checks)

    return ds.memo("dataset_profile", compute)
