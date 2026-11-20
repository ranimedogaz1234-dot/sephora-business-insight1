"""Validate every API figure against the real CSV files.

Recomputes the figures with an independent csv-module implementation
(``tests/oracle.py``) and compares them with the API responses.

Usage (from backend/, with SBI_DATA_DIR set)::

    python -m scripts.validate_against_csv
"""

from __future__ import annotations

import sys
import time

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app
from tests.checks import run_all
from tests.oracle import Oracle


def main() -> int:
    # Local measurement tool: hundreds of in-process requests, so no rate limiting.
    settings = get_settings().model_copy(update={"rate_limit_per_minute": 0})
    t = time.perf_counter()
    oracle = Oracle.load(settings.data_dir)
    print(
        f"oracle: {oracle.raw_count:,} raw rows -> {len(oracle.reviews):,} reviews, "
        f"{len(oracle.products):,} products ({time.perf_counter() - t:.1f}s)"
    )
    t = time.perf_counter()
    report = run_all(TestClient(create_app(settings)), oracle)
    elapsed = time.perf_counter() - t
    print(f"checks: {report.passed} passed, {len(report.failures)} failed ({elapsed:.1f}s)")
    for failure in report.failures:
        print("  FAIL", failure)
    return 1 if report.failures else 0


if __name__ == "__main__":
    sys.exit(main())
