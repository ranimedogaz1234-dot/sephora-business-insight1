"""Process-wide dataset access: Parquet cache first, CSV rebuild when needed."""

from __future__ import annotations

import logging
import threading
from pathlib import Path

from app.data import cache
from app.data.dataset import Dataset
from app.data.prepare import PreparedData

log = logging.getLogger(__name__)

_lock = threading.Lock()
_datasets: dict[Path, Dataset] = {}


def _from_prepared(prepared: PreparedData, texts_loader) -> Dataset:
    return Dataset(
        products=prepared.products,
        reviews=prepared.reviews,
        raw_review_count=prepared.raw_review_count,
        duplicate_reviews_removed=prepared.duplicate_reviews_removed,
        review_files=prepared.review_files,
        source="csv",
        texts_loader=texts_loader,
    )


def open_dataset(
    data_dir: Path,
    cache_dir: Path | None,
    *,
    verify_hash: bool = False,
) -> Dataset:
    """Load from a valid cache, or rebuild it from the CSVs (or read CSVs if caching is off)."""
    if cache_dir is None:
        from app.data.loader import read_dataset
        from app.data.prepare import prepare

        prepared = prepare(read_dataset(data_dir))
        texts = prepared.review_texts
        return _from_prepared(prepared, lambda: texts)

    manifest = cache.load_valid_manifest(data_dir, cache_dir, verify_hash=verify_hash)
    if manifest is None:
        log.info("Building dataset cache in %s", cache_dir.name)
        prepared, _ = cache.build_cache(data_dir, cache_dir)
        # Review text is re-read from Parquet on demand instead of being kept in memory.
        return _from_prepared(prepared, lambda: cache.read_review_texts(cache_dir))

    counts = manifest["counts"]
    return Dataset(
        products=cache.read_products(cache_dir),
        reviews=cache.read_reviews(cache_dir),
        raw_review_count=counts["raw_reviews"],
        duplicate_reviews_removed=counts["duplicate_reviews_removed"],
        review_files=tuple(manifest["review_files"]),
        source="cache",
        texts_loader=lambda: cache.read_review_texts(cache_dir),
    )


def get_dataset(
    data_dir: Path, cache_dir: Path | None = None, verify_hash: bool = False
) -> Dataset:
    key = data_dir.resolve()
    with _lock:
        if key not in _datasets:
            _datasets[key] = open_dataset(key, cache_dir, verify_hash=verify_hash)
        return _datasets[key]


def is_loaded(data_dir: Path) -> bool:
    return data_dir.resolve() in _datasets


def clear_cache() -> None:
    """Forget in-memory datasets (the on-disk Parquet cache is untouched)."""
    with _lock:
        _datasets.clear()
