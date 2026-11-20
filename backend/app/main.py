import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.ratelimit import RateLimiter, request_cost
from app.data.loader import DatasetNotFoundError
from app.data.store import get_dataset

log = logging.getLogger(__name__)

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    # JSON only: nothing may be loaded, framed or executed from an API response.
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cross-Origin-Opener-Policy": "same-origin",
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

    limiter = (
        RateLimiter(settings.rate_limit_per_minute, settings.rate_limit_burst)
        if settings.rate_limit_per_minute > 0
        else None
    )
    exempt = set(settings.rate_limit_exempt)

    def client_key(request: Request) -> str:
        if settings.trust_proxy_headers:
            forwarded = request.headers.get("x-forwarded-for", "")
            first = forwarded.split(",")[0].strip()
            if first:
                return first
        return request.client.host if request.client else "unknown"

    @app.middleware("http")
    async def rate_limit(request: Request, call_next):
        path = request.url.path
        if (
            limiter is None
            or request.method == "OPTIONS"
            or not path.startswith(settings.api_prefix)
        ):
            return await call_next(request)
        key = client_key(request)
        if key in exempt:
            return await call_next(request)
        allowed, retry_after, remaining = limiter.take(key, request_cost(path, request.url.query))
        if not allowed:
            return JSONResponse(
                {"detail": "Too many requests. Please slow down."},
                status_code=429,
                headers={"Retry-After": str(retry_after), **SECURITY_HEADERS},
            )
        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith(settings.api_prefix):
            for k, v in SECURITY_HEADERS.items():
                response.headers.setdefault(k, v)
        return response

    # Added last, so they run first: every response (429s included) gets CORS and gzip.
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
