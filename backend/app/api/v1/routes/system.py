from fastapi import APIRouter

from app.api.deps import DatasetDep, SettingsDep
from app.data.loader import dataset_available
from app.data.store import is_loaded
from app.schemas.overview import HealthResponse, OverviewResponse
from app.schemas.responses import FilterOptions
from app.services.filters import filter_options
from app.services.overview import build_overview

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health(settings: SettingsDep) -> HealthResponse:
    """Liveness plus dataset status. Never triggers a dataset load."""
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        environment=settings.environment,
        dataset_available=dataset_available(settings.data_dir),
        dataset_loaded=is_loaded(settings.data_dir),
    )


@router.get("/overview", response_model=OverviewResponse)
def overview(ds: DatasetDep) -> OverviewResponse:
    """Dataset summary (catalogue figures and review-record figures, kept separate)."""
    return build_overview(ds)


@router.get("/filters", response_model=FilterOptions)
def filters(ds: DatasetDep) -> FilterOptions:
    """Values for the UI filter controls: catalogue categories/brands and review-scope options."""
    return filter_options(ds)
