from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.utils.errors import AppError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan: load ML models once at startup
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Load rembg session and CLIP model at startup; release on shutdown."""
    settings = get_settings()

    logger.info("Loading rembg session (model=%s)…", settings.REMBG_MODEL)
    try:
        from app.services.segmentation import load_rembg_session

        load_rembg_session(settings.REMBG_MODEL)
    except Exception as exc:
        logger.error("rembg failed to initialise: %s", exc)

    logger.info("Loading CLIP model (%s)…", settings.CLIP_MODEL)
    try:
        from app.services.classification import load_clip_model

        load_clip_model(settings.CLIP_MODEL)
    except Exception as exc:
        logger.error("CLIP model failed to initialise: %s", exc)

    logger.info("Application startup complete.")
    yield
    logger.info("Application shutdown.")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Virtual Fitting Service",
        description="AI-powered virtual clothing try-on backend.",
        version="1.0.0",
        lifespan=lifespan,
    )

    # ---- CORS ----------------------------------------------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---- Global exception handler -------------------------------------------
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    # ---- Routers ------------------------------------------------------------
    from app.routers import health, tryon, upload, wardrobe

    # Health endpoints live at the root (no /api/v1 prefix)
    app.include_router(health.router)

    # All other routers are namespaced under /api/v1
    api_prefix = "/api/v1"
    app.include_router(wardrobe.router, prefix=api_prefix)
    app.include_router(upload.router, prefix=api_prefix)
    app.include_router(tryon.router, prefix=api_prefix)

    return app


app = create_app()
