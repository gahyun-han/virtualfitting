from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from app.models.user import UserContext
from app.utils.errors import AuthenticationError

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
) -> UserContext:
    """Validate the Supabase JWT and return the authenticated :class:`UserContext`.

    The token is expected in the ``Authorization: Bearer <token>`` header.
    """
    if not token:
        raise AuthenticationError("No authentication token provided.")

    from jose import ExpiredSignatureError, JWTError, jwt  # type: ignore[import]

    from app.config import get_settings

    settings = get_settings()

    try:
        payload: Dict[str, Any] = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Supabase JWTs may have varying aud
        )
    except ExpiredSignatureError:
        raise AuthenticationError("Token has expired.")
    except JWTError as exc:
        logger.debug("JWT validation failed: %s", exc)
        raise AuthenticationError("Invalid authentication token.")

    user_id: str = payload.get("sub", "")
    email: str = payload.get("email", "")

    if not user_id:
        raise AuthenticationError("Token payload is missing 'sub' claim.")

    return UserContext(id=user_id, email=email)
