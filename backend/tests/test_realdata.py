"""Optional: validate the API against the REAL dataset.

Skipped unless SBI_VALIDATE_REAL_DATA=1 (the private CSVs are never available in CI).
Uses SBI_DATA_DIR / SBI_CACHE_DIR from the environment or backend/.env.
"""

import os

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.data.loader import dataset_available
from app.main import create_app
from tests.checks import run_all
from tests.oracle import Oracle

pytestmark = pytest.mark.skipif(
    os.environ.get("SBI_VALIDATE_REAL_DATA") != "1",
    reason="set SBI_VALIDATE_REAL_DATA=1 to validate against the real dataset",
)


def test_api_matches_real_csv_files():
    settings = Settings()
    if not dataset_available(settings.data_dir):
        pytest.skip("real dataset not found at SBI_DATA_DIR")
    report = run_all(TestClient(create_app(settings)), Oracle.load(settings.data_dir))
    assert report.failures == []
