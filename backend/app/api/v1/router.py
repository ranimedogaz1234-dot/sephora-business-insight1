from fastapi import APIRouter

from app.api.v1.routes import analytics, system

api_router = APIRouter()
api_router.include_router(system.router)
for router in analytics.routers:
    api_router.include_router(router)
