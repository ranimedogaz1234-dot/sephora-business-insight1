from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_settings
from app.core.config import Settings
from app.data.store import clear_cache
from app.main import create_app

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _reset_cache():
    clear_cache()
    yield
    clear_cache()


def make_client(data_dir: Path) -> TestClient:
    settings = Settings(data_dir=data_dir, environment="test")
    app = create_app(settings)
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app)


@pytest.fixture
def client() -> TestClient:
    return make_client(FIXTURES)


@pytest.fixture
def empty_client(tmp_path: Path) -> TestClient:
    return make_client(tmp_path)
