"""Benchmark dataset loading and API latency against the real dataset.

Usage (from backend/)::

    python -m scripts.benchmark            # uses SBI_DATA_DIR / SBI_CACHE_DIR
    python -m scripts.benchmark --rebuild  # also time a full cache rebuild

Reports wall times and process memory. Nothing is written except the cache.
"""

from __future__ import annotations

import argparse
import statistics
import sys
import time

import psutil
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.data import cache
from app.data.store import clear_cache, get_dataset
from app.main import create_app

ENDPOINTS = [
    "/kpis",
    "/kpis?brand=CLINIQUE&date_from=2020-01-01&date_to=2021-12-31",
    "/reviews/rating-distribution",
    "/reviews/trends?granularity=month",
    "/reviews/activity-heatmap",
    "/products/top-reviewed?limit=10",
    "/products/top-by-year?year=2021&limit=10",
    "/products/rating-popularity?limit=1000",
    "/brands?page_size=50",
    "/brands/top?limit=10",
    "/categories/catalogue",
    "/categories/reviews",
    "/prices/distribution",
    "/filters",
    "/products?q=serum&sort_by=review_record_count&page_size=50",
    "/reviews?page_size=50",
    "/reviews?q=holy%20grail&sort_by=helpfulness&page_size=50",
    "/reviews?subcategory=Sunscreen&rating=1&page_size=50",
    "/reviews/profiles",
    "/brands/review-stats?min_reviews=100&sort_by=average_rating&limit=10",
    "/brands/review-stats?min_reviews=100&limit=500",
    "/dataset/profile",
    "/sentiment/summary",
    "/sentiment/breakdown?by=brand&min_classified=50",
    "/sentiment/trends?granularity=month",
    "/sentiment/insights",
]


def dataset_endpoints(ds) -> list[str]:
    """Endpoints whose parameters depend on the loaded dataset (most reviewed products/brand)."""
    from urllib.parse import quote

    top = ds.reviews["product_id"].value_counts().index[:2].astype(str)
    brand = str(ds.reviews["brand_name"].value_counts().index[0])
    return [
        f"/products/compare?product_id={top[0]}&product_id={top[1]}",
        f"/products/compare?product_id={top[0]}&product_id={top[1]}&granularity=quarter",
        f"/brands/detail?brand={quote(brand)}",
        f"/categories/catalogue?brand={quote(brand)}",
        f"/kpis?brand={quote(brand)}",
        f"/sentiment/breakdown?by=product&min_classified=1&product_id={top[0]}",
    ]


def rss_mb() -> float:
    return psutil.Process().memory_info().rss / 1e6


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rebuild", action="store_true")
    parser.add_argument("--repeat", type=int, default=5)
    args = parser.parse_args(argv)
    s = get_settings()

    if args.rebuild:
        t = time.perf_counter()
        cache.build_cache(s.data_dir, s.cache_dir)
        print(f"cache rebuild from CSV: {time.perf_counter() - t:6.2f} s")

    clear_cache()
    base = rss_mb()
    t = time.perf_counter()
    ds = get_dataset(s.data_dir, s.cache_dir)
    elapsed = time.perf_counter() - t
    print(f"dataset open ({ds.source}): {elapsed:6.2f} s, +{rss_mb() - base:.0f} MB RSS")
    print(
        f"  reviews frame {ds.reviews.memory_usage(deep=True).sum() / 1e6:.0f} MB, "
        f"products frame {ds.products.memory_usage(deep=True).sum() / 1e6:.0f} MB"
    )

    client = TestClient(create_app(s))
    print(f"\n{'endpoint':66} {'first':>8} {'repeat p50':>11}")
    for url in ENDPOINTS + dataset_endpoints(ds):
        t = time.perf_counter()
        res = client.get(f"{s.api_prefix}{url}")
        first = (time.perf_counter() - t) * 1000
        if res.status_code != 200:
            print(f"{url:66} HTTP {res.status_code}")
            return 1
        times = []
        for _ in range(args.repeat):
            t = time.perf_counter()
            client.get(f"{s.api_prefix}{url}")
            times.append((time.perf_counter() - t) * 1000)
        print(f"{url:66} {first:6.0f}ms {statistics.median(times):9.1f}ms")
    print(f"\nprocess RSS after run: {rss_mb():.0f} MB (review text loaded: {ds.texts_loaded})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
