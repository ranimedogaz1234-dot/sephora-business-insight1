from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.data.loader import Dataset, DatasetNotFoundError
from app.data.store import get_dataset

SettingsDep = Annotated[Settings, Depends(get_settings)]


def dataset_dependency(settings: SettingsDep) -> Dataset:
    try:
        return get_dataset(settings.data_dir)
    except DatasetNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Dataset not available. Set SBI_DATA_DIR to the folder holding the CSV files.",
        ) from exc


DatasetDep = Annotated[Dataset, Depends(dataset_dependency)]
