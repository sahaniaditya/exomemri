"""FastAPI application factory."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.dependencies import _shared_embedding_service
from app.errors import register_exception_handlers
from app.logging import RequestIdMiddleware, configure_logging
from app.request_limits import MaxBodySizeMiddleware
from app.routers import auth as auth_router
from app.routers import coverage as coverage_router
from app.routers import credits as credits_router
from app.routers import graph as graph_router
from app.routers import plan as plan_router
from app.routers import profile as profile_router
from app.routers import reviews as reviews_router
from app.routers import session as session_router
from app.routers import sharing as sharing_router
from app.routers import sources as sources_router
from app.routers import spaces as spaces_router

API_PREFIX = "/v1"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Load the local embedding model before the app accepts traffic, so the
    # first user request doesn't pay for it. Runs in a thread to keep the
    # event loop free. If the model can't load, startup fails fast.
    await asyncio.to_thread(_shared_embedding_service)
    yield


def _configure_cors(app: FastAPI, settings: Settings) -> None:
    kwargs: dict = {
        "allow_methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["authorization", "content-type", "x-request-id"],
        "allow_credentials": True,
    }
    # Explicit origins: pinned extension ids + web app origins (e.g. Vercel).
    allow_origins = [*settings.cors_extension_origins, *settings.cors_web_origins]
    if settings.cors_allow_any_extension:
        # Reflect any chrome-extension:// origin (dev convenience). Cannot use
        # "*" together with allow_credentials, so match via regex instead.
        kwargs["allow_origin_regex"] = r"chrome-extension://.*"
    if allow_origins:
        kwargs["allow_origins"] = allow_origins
    app.add_middleware(CORSMiddleware, **kwargs)


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging()

    app = FastAPI(
        title="exomemri Capture API",
        version="0.1.0",
        description="Phase 0 thin capture endpoint: writes raw artifacts to Supabase Storage.",
        lifespan=lifespan,
    )

    app.add_middleware(RequestIdMiddleware)
    _configure_cors(app, settings)
    # Last registered = outermost: reject huge bodies before CORS / Request-Id.
    app.add_middleware(MaxBodySizeMiddleware)
    register_exception_handlers(app)

    app.include_router(auth_router.router, prefix=API_PREFIX)
    app.include_router(session_router.router, prefix=API_PREFIX)
    app.include_router(spaces_router.router, prefix=API_PREFIX)
    app.include_router(sources_router.router, prefix=API_PREFIX)
    app.include_router(graph_router.router, prefix=API_PREFIX)
    app.include_router(coverage_router.router, prefix=API_PREFIX)
    app.include_router(credits_router.router, prefix=API_PREFIX)
    app.include_router(plan_router.router, prefix=API_PREFIX)
    app.include_router(sharing_router.router, prefix=API_PREFIX)
    app.include_router(sharing_router.shared_with_me_router, prefix=API_PREFIX)
    app.include_router(sharing_router.share_links_router, prefix=API_PREFIX)
    app.include_router(profile_router.router, prefix=API_PREFIX)
    app.include_router(profile_router.public_router, prefix=API_PREFIX)
    app.include_router(reviews_router.router, prefix=API_PREFIX)
    app.include_router(reviews_router.public_router, prefix=API_PREFIX)

    @app.get("/health", tags=["meta"])
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()