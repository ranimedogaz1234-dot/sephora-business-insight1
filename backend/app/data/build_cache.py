"""Build (or verify) the Parquet dataset cache.

Usage::

    python -m app.data.build_cache            # build only if missing/stale
    python -m app.data.build_cache --force    # always rebuild
"""

from __future__ import annotations

import argparse
import sys
import time

from app.core.config import get_settings
from app.data import cache
from app.data.loader import DatasetNotFoundError


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--force", action="store_true", help="rebuild even if the cache is valid")
    args = parser.parse_args(argv)

    settings = get_settings()
    started = time.perf_counter()
    try:
        manifest = None
        if not args.force:
            manifest = cache.load_valid_manifest(
                settings.data_dir, settings.cache_dir, verify_hash=True
            )
        status = "valid (content hashes verified)"
        if manifest is None:
            _, manifest = cache.build_cache(settings.data_dir, settings.cache_dir)
            status = "built"
    except DatasetNotFoundError:
        print("Dataset not found. Set SBI_DATA_DIR to the folder with the CSV files.")
        return 1

    counts = manifest["counts"]
    print(f"Cache {status} in {time.perf_counter() - started:.1f}s")
    print(
        f"  products={counts['products']:,} raw_reviews={counts['raw_reviews']:,} "
        f"duplicates_removed={counts['duplicate_reviews_removed']:,} reviews={counts['reviews']:,}"
    )
    print(f"  review_id_digest={manifest['review_id_digest']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
