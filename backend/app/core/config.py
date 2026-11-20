"""Application settings loaded from environment variables (and an optional .env file)."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr
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
    # Persistent Parquet cache of the prepared dataset (derived private data: never commit).
    cache_dir: Path = Field(default=BACKEND_DIR / ".cache")
    cache_enabled: bool = True
    # Also compare SHA-256 of the source CSVs when validating the cache (slower start).
    cache_verify_hash: bool = False
    # Load the dataset when the server starts instead of on the first data request.
    preload: bool = False
    # Frontend dev server runs on 3001 so it never collides with other projects on 3000.
    cors_origins: list[str] = ["http://localhost:3001", "http://127.0.0.1:3001"]
    api_prefix: str = "/api/v1"

    # --- AI sentiment (classification runs only from the CLI; the API only reads results)
    # Persistent label store; defaults to <cache_dir>/sentiment.sqlite3 (gitignored).
    sentiment_db: Path | None = None
    sentiment_model: str = "claude-opus-5-5"
    sentiment_effort: Literal["low", "medium", "high"] = "low"
    sentiment_group_size: int = Field(20, ge=1, le=100)
    # Read from ANTHROPIC_API_KEY (environment or backend/.env). Never logged or returned.
    anthropic_api_key: SecretStr | None = Field(None, validation_alias="ANTHROPIC_API_KEY")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def sentiment_db_path(self) -> Path:
        return self.sentiment_db or (self.cache_dir / "sentiment.sqlite3")

    @property
    def effective_cache_dir(self) -> Path | None:
        return self.cache_dir if self.cache_enabled else None


@lru_cache
def get_settings() -> Settings:
    return Settings()
