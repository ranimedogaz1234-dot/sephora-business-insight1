"""Persistent, reproducible Parquet cache of the prepared dataset.

Layout (inside ``SBI_CACHE_DIR``, never committed)::

    manifest.json          cache version, source fingerprints, counts, digests
    products.parquet       prepared catalogue
    reviews.parquet        prepared review table (no free text)
    review_texts.parquet   review titles and texts, row-aligned with reviews

Validity: the cache is reused only if ``CACHE_VERSION`` matches and every source
CSV has the same name, size and modification time as when the cache was built
(set ``SBI_CACHE_VERIFY_HASH=true`` to also compare SHA-256 content hashes).
Otherwise it is rebuilt from the CSVs. Writes are staged in a temporary folder
and the manifest is written last, so an interrupted build is never trusted.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from app.data.loader import DatasetNotFoundError, read_dataset, source_files
from app.data.prepare import PreparedData, prepare

# Bump whenever loading/cleaning/preparation logic changes the cached content.
CACHE_VERSION = 1

MANIFEST = "manifest.json"
PRODUCTS_FILE = "products.parquet"
REVIEWS_FILE = "reviews.parquet"
TEXTS_FILE = "review_texts.parquet"
DATA_FILES = (PRODUCTS_FILE, REVIEWS_FILE, TEXTS_FILE)


def sha256_file(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while block := f.read(chunk):
            h.update(block)
    return h.hexdigest()


def describe_sources(data_dir: Path, with_hash: bool) -> list[dict[str, Any]]:
    files = source_files(data_dir)
    missing = [f.name for f in files if not f.is_file()]
    if missing or len(files) < 2:
        raise DatasetNotFoundError("Dataset CSV files not found")
    out = []
    for f in files:
        st = f.stat()
        entry: dict[str, Any] = {"name": f.name, "size": st.st_size, "mtime_ns": st.st_mtime_ns}
        if with_hash:
            entry["sha256"] = sha256_file(f)
        out.append(entry)
    return out


def review_id_digest(review_ids: pd.Series) -> str:
    """Order-independent digest of all review IDs (for reproducibility checks)."""
    joined = "\n".join(sorted(review_ids.astype(str).tolist()))
    return hashlib.sha256(joined.encode()).hexdigest()


def read_manifest(cache_dir: Path) -> dict[str, Any] | None:
    try:
        return json.loads((cache_dir / MANIFEST).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def manifest_matches(
    manifest: dict[str, Any] | None, data_dir: Path, cache_dir: Path, verify_hash: bool
) -> bool:
    if not manifest or manifest.get("cache_version") != CACHE_VERSION:
        return False
    try:
        current = describe_sources(data_dir, with_hash=verify_hash)
    except DatasetNotFoundError:
        return False
    keys = ("name", "size", "mtime_ns", "sha256") if verify_hash else ("name", "size", "mtime_ns")
    cached = [{k: s.get(k) for k in keys} for s in manifest.get("sources", [])]
    if [{k: s.get(k) for k in keys} for s in current] != cached:
        return False
    return all((cache_dir / name).is_file() for name in DATA_FILES)


def write_cache(prepared: PreparedData, data_dir: Path, cache_dir: Path) -> dict[str, Any]:
    cache_dir.mkdir(parents=True, exist_ok=True)
    staging = cache_dir / f".staging-{uuid.uuid4().hex}"
    staging.mkdir()
    try:
        opts = {"index": False, "engine": "pyarrow", "compression": "zstd"}
        prepared.products.to_parquet(staging / PRODUCTS_FILE, **opts)
        prepared.reviews.to_parquet(staging / REVIEWS_FILE, **opts)
        prepared.review_texts.to_parquet(staging / TEXTS_FILE, **opts)

        manifest = {
            "cache_version": CACHE_VERSION,
            "created_at": datetime.now(UTC).isoformat(timespec="seconds"),
            "pandas_version": pd.__version__,
            "sources": describe_sources(data_dir, with_hash=True),
            "review_files": list(prepared.review_files),
            "counts": {
                "products": len(prepared.products),
                "raw_reviews": prepared.raw_review_count,
                "duplicate_reviews_removed": prepared.duplicate_reviews_removed,
                "reviews": len(prepared.reviews),
            },
            "review_id_digest": review_id_digest(prepared.reviews["review_id"]),
        }

        # Invalidate first, swap data files, then publish the manifest last.
        (cache_dir / MANIFEST).unlink(missing_ok=True)
        for name in DATA_FILES:
            os.replace(staging / name, cache_dir / name)
        tmp_manifest = staging / MANIFEST
        tmp_manifest.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        os.replace(tmp_manifest, cache_dir / MANIFEST)
        return manifest
    finally:
        shutil.rmtree(staging, ignore_errors=True)


def build_cache(data_dir: Path, cache_dir: Path) -> tuple[PreparedData, dict[str, Any]]:
    prepared = prepare(read_dataset(data_dir))
    manifest = write_cache(prepared, data_dir, cache_dir)
    return prepared, manifest


def load_valid_manifest(
    data_dir: Path, cache_dir: Path, verify_hash: bool = False
) -> dict[str, Any] | None:
    manifest = read_manifest(cache_dir)
    return manifest if manifest_matches(manifest, data_dir, cache_dir, verify_hash) else None


def read_products(cache_dir: Path) -> pd.DataFrame:
    return pd.read_parquet(cache_dir / PRODUCTS_FILE)


def read_reviews(cache_dir: Path) -> pd.DataFrame:
    return pd.read_parquet(cache_dir / REVIEWS_FILE)


def read_review_texts(cache_dir: Path) -> pd.DataFrame:
    return pd.read_parquet(cache_dir / TEXTS_FILE)
