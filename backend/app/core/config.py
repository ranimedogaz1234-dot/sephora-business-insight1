"""Application settings loaded from environment variables (and an optional .env file)."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SBI_",
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Sephora Business Insight API"
    environment: str = "development"
    # Folder holding product_info.csv and the reviews_*.csv files.
    # Kept OUTSIDE the repository — the original datasets are private.
    data_dir: Path = Field(default=BACKEND_DIR.parent / "data")
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    api_prefix: str = "/api/v1"


@lru_cache
def get_settings() -> Settings:
    return Settings()
