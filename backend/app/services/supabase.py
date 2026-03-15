from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Client factory
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def get_supabase_client():  # type: ignore[return]
    """Return a service-role Supabase client (singleton, cached)."""
    from supabase import Client, create_client  # type: ignore[import]

    from app.config import get_settings

    settings = get_settings()
    client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return client


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Return the auth.users row for *user_id*, or *None* if not found.

    Note: This queries the ``profiles`` table that mirrors ``auth.users``.
    Adjust the table/column names to match your Supabase schema.
    """
    client = get_supabase_client()
    try:
        response = (
            client.table("profiles")
            .select("*")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        return response.data  # type: ignore[return-value]
    except Exception as exc:
        logger.warning("get_user_by_id(%s) failed: %s", user_id, exc)
        return None


async def check_connection() -> bool:
    """Ping Supabase to verify the connection is healthy.

    Used by the /ready health-check endpoint.
    """
    client = get_supabase_client()
    try:
        # A lightweight query – just fetch 1 row from any accessible table
        client.table("wardrobe_items").select("id").limit(1).execute()
        return True
    except Exception as exc:
        logger.error("Supabase connection check failed: %s", exc)
        return False
