from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.exception_handlers import app_exception_handler, unhandled_exception_handler
from app.exceptions import AppException


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    from app.services.realtime import manager as ws_manager
    await ws_manager.init()

    yield

    # Shutdown
    await ws_manager.shutdown()
    from app.database import engine
    await engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception handlers
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    # Routers
    from app.routers import health, auth, invite, orgs, ingestion, api_keys, csv_uploads, dashboards, shared, alerts, ws

    # Non-prefixed health
    app.include_router(health.router)

    # API v1 prefix
    prefix = settings.api_v1_prefix
    app.include_router(auth.router, prefix=prefix)
    app.include_router(invite.router, prefix=prefix)
    app.include_router(orgs.router, prefix=prefix)
    app.include_router(ingestion.router, prefix=prefix)
    app.include_router(api_keys.router, prefix=prefix)
    app.include_router(csv_uploads.router, prefix=prefix)
    app.include_router(dashboards.router, prefix=prefix)
    app.include_router(shared.router, prefix=prefix)
    app.include_router(alerts.router, prefix=prefix)

    # WebSocket (no prefix)
    app.include_router(ws.router)

    return app


app = create_app()
