import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.data.loader import DatasetNotFoundError
from app.data.store import get_dataset

log = logging.getLogger(__name__)

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
}


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        if settings.preload:
            try:
                get_dataset(
                    settings.data_dir,
                    settings.effective_cache_dir,
                    verify_hash=settings.cache_verify_hash,
                )
            except DatasetNotFoundError:
                log.warning("Preload skipped: dataset not found (set SBI_DATA_DIR).")
        yield

    docs = not settings.is_production
    app = FastAPI(
        title=settings.app_name,
        version="0.2.0",
        lifespan=lifespan,
        docs_url="/docs" if docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if docs else None,
    )
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith(settings.api_prefix):
            for k, v in SECURITY_HEADERS.items():
                response.headers.setdefault(k, v)
        return response

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
