from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_settings
from app.core.config import Settings
from app.data.store import clear_cache
from app.main import create_app
from tests.oracle import Oracle

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _reset_store():
    clear_cache()
    yield
    clear_cache()


def make_client(data_dir: Path, cache_dir: Path | None, **overrides) -> TestClient:
    settings = Settings(
        data_dir=data_dir,
        cache_dir=cache_dir or Path("unused"),
        cache_enabled=cache_dir is not None,
        # Rate limiting is off unless a test sets it: suites like the oracle checks send
        # hundreds of requests in a burst, and the limiter has its own tests.
        **{"environment": "test", "rate_limit_per_minute": 0, **overrides},
    )
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app)


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    """API over the synthetic fixtures, with the Parquet cache in a temp folder."""
    return make_client(FIXTURES, tmp_path / "cache")


@pytest.fixture
def csv_client() -> TestClient:
    """API over the synthetic fixtures with caching disabled (straight from CSV)."""
    return make_client(FIXTURES, None)


@pytest.fixture
def empty_client(tmp_path: Path) -> TestClient:
    return make_client(tmp_path, tmp_path / "cache")


@pytest.fixture(scope="session")
def oracle() -> Oracle:
    return Oracle.load(FIXTURES)


def api(client: TestClient, path: str, params=None, status: int = 200):
    res = client.get(f"/api/v1{path}", params=params)
    assert res.status_code == status, res.text
    return res.json()
