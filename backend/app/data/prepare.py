"""Turn raw CSV frames into compact, analysis-ready tables.

Memory/speed choices
--------------------
* Low-cardinality text (brands, categories, skin attributes) -> ``category``.
* Small integers -> ``int8``/``int16``/``int32``; ratios -> ``float32``.
* Review text and titles are split into a separate table that is only loaded
  when an endpoint actually needs text (review explorer / search).
* Product name, brand and price are identical in the review files and the
  catalogue for every reviewed product (verified), so the review table keeps
  ``product_id`` + ``brand_name`` + ``subcategory`` and joins the rest.
* Rows are sorted by (submission_time, review_id) so the prepared tables are
  identical no matter how the source files are ordered.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from app.data.loader import RawData

CATALOGUE_FLAGS = ["limited_edition", "new", "online_only", "out_of_stock", "sephora_exclusive"]
REVIEW_TEXT_COLUMNS = ["review_title", "review_text"]


def _category(series: pd.Series) -> pd.Categorical:
    """Categorical with pandas' default ``str`` labels (NaN for missing).

    This is exactly the form a Parquet round-trip produces, so frames built from the
    CSVs and frames read back from the cache are identical (dtypes included).
    """
    return pd.Categorical(series.astype("str"))


@dataclass(frozen=True)
class PreparedData:
    products: pd.DataFrame
    reviews: pd.DataFrame
    review_texts: pd.DataFrame  # row-aligned with ``reviews``
    raw_review_count: int
    duplicate_reviews_removed: int
    review_files: tuple[str, ...]


def prepare_products(raw: pd.DataFrame) -> pd.DataFrame:
    df = raw.copy()
    df = df.rename(columns={"rating": "catalogue_rating", "reviews": "sephora_review_count"})
    df["product_id"] = df["product_id"].astype("string")
    df["product_name"] = df["product_name"].astype("string")
    for col in ["brand_name", "primary_category", "secondary_category", "tertiary_category"]:
        df[col] = _category(df[col])
    for col in ["size", "variation_type", "variation_value", "variation_desc"]:
        df[col] = df[col].astype("string")
    for col in ["ingredients", "highlights"]:
        df[col] = df[col].astype("string")
    df["brand_id"] = df["brand_id"].astype("int32")
    df["loves_count"] = df["loves_count"].astype("int64")
    df["sephora_review_count"] = df["sephora_review_count"].astype("Int32")
    df["catalogue_rating"] = df["catalogue_rating"].astype("float64")
    df["child_count"] = df["child_count"].astype("int16")
    for col in CATALOGUE_FLAGS:
        df[col] = df[col].astype(bool)
    return df.sort_values("product_id", kind="stable").reset_index(drop=True)


def prepare_reviews(
    reviews: pd.DataFrame, products: pd.DataFrame
) -> tuple[pd.DataFrame, pd.DataFrame]:
    df = reviews.sort_values(["submission_time", "review_id"], kind="stable").reset_index(drop=True)
    lookup = products.set_index("product_id")[["secondary_category", "tertiary_category"]]
    cats = lookup.reindex(df["product_id"])

    core = pd.DataFrame(
        {
            "review_id": df["review_id"].astype("string[pyarrow]"),
            # Reviewer identity is only needed for counting distinct reviewers, so the raw
            # author_id is replaced by a dense integer key (sorted factorisation =
            # deterministic). It is never exposed by the API.
            "author_key": pd.factorize(df["author_id"], sort=True)[0].astype("int32"),
            "product_id": _category(df["product_id"]),
            "brand_name": _category(df["brand_name"]),
            "subcategory": _category(cats["secondary_category"]),
            "tertiary_category": _category(cats["tertiary_category"]),
            "rating": df["rating"].astype("int8"),
            "is_recommended": df["is_recommended"].astype("float32"),
            "helpfulness": df["helpfulness"].astype("float32"),
            "total_feedback_count": df["total_feedback_count"].astype("int32"),
            "total_neg_feedback_count": df["total_neg_feedback_count"].astype("int32"),
            "total_pos_feedback_count": df["total_pos_feedback_count"].astype("int32"),
            "submission_time": df["submission_time"].astype("datetime64[ms]"),
            "year": df["submission_time"].dt.year.astype("int16"),
            "month": df["submission_time"].dt.month.astype("int8"),
            "skin_tone": _category(df["skin_tone"]),
            "eye_color": _category(df["eye_color"]),
            "skin_type": _category(df["skin_type"]),
            "hair_color": _category(df["hair_color"]),
        }
    )
    texts = pd.DataFrame({col: df[col].astype("string[pyarrow]") for col in REVIEW_TEXT_COLUMNS})
    return core, texts


def prepare(raw: RawData) -> PreparedData:
    products = prepare_products(raw.products)
    reviews, texts = prepare_reviews(raw.reviews, products)
    return PreparedData(
        products=products,
        reviews=reviews,
        review_texts=texts,
        raw_review_count=raw.raw_review_count,
        duplicate_reviews_removed=raw.duplicate_reviews_removed,
        review_files=raw.review_files,
    )
