from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.data.dataset import Dataset
from app.data.loader import DatasetNotFoundError
from app.data.store import get_dataset
from app.sentiment.store import SentimentStore

SettingsDep = Annotated[Settings, Depends(get_settings)]


def dataset_dependency(settings: SettingsDep) -> Dataset:
    try:
        return get_dataset(
            settings.data_dir,
            settings.effective_cache_dir,
            verify_hash=settings.cache_verify_hash,
        )
    except DatasetNotFoundError as exc:
        # Never echo filesystem paths back to clients.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dataset not available. Set SBI_DATA_DIR to the folder holding the CSV files.",
        ) from exc


DatasetDep = Annotated[Dataset, Depends(dataset_dependency)]


def sentiment_store_dependency(settings: SettingsDep) -> SentimentStore:
    return SentimentStore(settings.sentiment_db_path)


SentimentStoreDep = Annotated[SentimentStore, Depends(sentiment_store_dependency)]
