"""CSV loading and cleaning.

The six CSV files are the single source of truth — there is no database.

Review cleaning rules
---------------------
* The anonymous CSV index column (``Unnamed: 0``) is dropped: it is a per-file
  row counter, not part of the review.
* Only *exact* duplicate copies (every remaining field identical) are removed.
  Reviews that look similar but differ in any meaningful field are preserved.
* Every review receives a stable identifier derived from a deterministic hash
  of its content, so the same review always gets the same ``review_id``.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

PRODUCT_FILE = "product_info.csv"
REVIEW_GLOB = "reviews_*.csv"

REVIEW_COLUMNS: list[str] = [
    "author_id",
    "rating",
    "is_recommended",
    "helpfulness",
    "total_feedback_count",
    "total_neg_feedback_count",
    "total_pos_feedback_count",
    "submission_time",
    "review_text",
    "review_title",
    "skin_tone",
    "eye_color",
    "skin_type",
    "hair_color",
    "product_id",
    "product_name",
    "brand_name",
    "price_usd",
]

REVIEW_DTYPES = {
    "author_id": "string",
    "product_id": "string",
    "review_text": "string",
    "review_title": "string",
    "skin_tone": "string",
    "eye_color": "string",
    "skin_type": "string",
    "hair_color": "string",
    "product_name": "string",
    "brand_name": "string",
}


class DatasetNotFoundError(FileNotFoundError):
    """Raised when the configured data directory does not contain the CSV files."""


@dataclass(frozen=True)
class Dataset:
    products: pd.DataFrame
    reviews: pd.DataFrame
    raw_review_count: int
    duplicate_reviews_removed: int
    review_files: tuple[str, ...]


def find_review_files(data_dir: Path) -> list[Path]:
    return sorted(data_dir.glob(REVIEW_GLOB))


def dataset_available(data_dir: Path) -> bool:
    return (data_dir / PRODUCT_FILE).is_file() and bool(find_review_files(data_dir))


def load_products(data_dir: Path) -> pd.DataFrame:
    path = data_dir / PRODUCT_FILE
    if not path.is_file():
        raise DatasetNotFoundError(f"Missing {PRODUCT_FILE} in {data_dir}")
    return pd.read_csv(path, dtype={"product_id": "string", "brand_name": "string"})


def read_raw_reviews(data_dir: Path) -> tuple[pd.DataFrame, tuple[str, ...]]:
    files = find_review_files(data_dir)
    if not files:
        raise DatasetNotFoundError(f"No {REVIEW_GLOB} files in {data_dir}")
    frames = [
        pd.read_csv(f, usecols=lambda c: c in REVIEW_COLUMNS, dtype=REVIEW_DTYPES)
        for f in files
    ]
    raw = pd.concat(frames, ignore_index=True)[REVIEW_COLUMNS]
    return raw, tuple(f.name for f in files)


def add_review_ids(reviews: pd.DataFrame) -> pd.DataFrame:
    """Attach a deterministic content hash as ``review_id``.

    ``pandas.util.hash_pandas_object`` uses a fixed hash key, so the value is
    stable across runs, machines and file orderings. Exact duplicates are
    removed beforehand, which makes the content hash unique per review.
    """
    hashes = pd.util.hash_pandas_object(reviews[REVIEW_COLUMNS], index=False)
    ids = hashes.map(lambda h: f"r_{h:016x}")
    out = reviews.copy()
    out.insert(0, "review_id", ids.astype("string"))
    return out


def clean_reviews(raw: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    deduped = raw.drop_duplicates(keep="first").reset_index(drop=True)
    removed = len(raw) - len(deduped)
    deduped["submission_time"] = pd.to_datetime(deduped["submission_time"], errors="coerce")
    return add_review_ids(deduped), removed


def load_dataset(data_dir: Path) -> Dataset:
    products = load_products(data_dir)
    raw, files = read_raw_reviews(data_dir)
    reviews, removed = clean_reviews(raw)
    return Dataset(
        products=products,
        reviews=reviews,
        raw_review_count=len(raw),
        duplicate_reviews_removed=removed,
        review_files=files,
    )
