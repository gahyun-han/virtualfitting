from __future__ import annotations

import logging
from typing import Dict

from fastapi import APIRouter, Response

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health", response_model=Dict[str, str])
async def health() -> Dict[str, str]:
    """Simple liveness probe."""
    return {"status": "ok"}


@router.get("/ready", response_model=Dict[str, str])
async def ready(response: Response) -> Dict[str, str]:
    """Readiness probe – verifies the Supabase connection."""
    from app.services.supabase import check_connection

    is_connected = await check_connection()
    if not is_connected:
        response.status_code = 503
        return {"status": "unavailable", "detail": "Supabase connection failed"}
    return {"status": "ok"}
