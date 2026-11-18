from fastapi import APIRouter

from app.api.deps import DatasetDep, SettingsDep
from app.data.loader import dataset_available
from app.data.store import is_loaded
from app.schemas.overview import HealthResponse, OverviewResponse
from app.services.overview import build_overview

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health(settings: SettingsDep) -> HealthResponse:
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        environment=settings.environment,
        dataset_available=dataset_available(settings.data_dir),
        dataset_loaded=is_loaded(settings.data_dir),
    )


@router.get("/overview", response_model=OverviewResponse)
def overview(ds: DatasetDep) -> OverviewResponse:
    return build_overview(ds)
