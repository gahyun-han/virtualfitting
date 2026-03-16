from __future__ import annotations

import logging

from fastapi import Depends, Query, Request
from fastapi.security import OAuth2PasswordBearer

from app.models.user import UserContext
from app.utils.errors import AuthenticationError

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)


async def get_current_user(
    request: Request,
    bearer_token: str = Depends(oauth2_scheme),
    token: str | None = Query(default=None),
) -> UserContext:
    """Validate the Supabase JWT via the Supabase Auth API and return UserContext.

    Accepts token via Authorization header or ?token= query param (for SSE/EventSource).
    """
    resolved_token = bearer_token or token
    if not resolved_token:
        raise AuthenticationError("No authentication token provided.")

    from app.services.supabase import get_supabase_client

    try:
        client = get_supabase_client()
        response = client.auth.get_user(resolved_token)
        user = response.user
    except Exception as exc:
        logger.error("Supabase token validation failed: %s", exc)
        raise AuthenticationError("Invalid authentication token.")

    if not user:
        raise AuthenticationError("Invalid authentication token.")

    return UserContext(id=str(user.id), email=user.email or "")
