from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

from app.utils.errors import TryOnError

logger = logging.getLogger(__name__)

# Replicate model identifier
_REPLICATE_MODEL = "yisol/idm-vton"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_replicate_client():  # type: ignore[return]
    """Return an authenticated Replicate client."""
    import replicate  # type: ignore[import]

    from app.config import get_settings

    settings = get_settings()
    client = replicate.Client(api_token=settings.REPLICATE_API_TOKEN)
    return client


# ---------------------------------------------------------------------------
# Public async API
# ---------------------------------------------------------------------------


async def run_tryon(
    person_image_url: str,
    clothing_image_url: str,
    garment_description: str,
) -> str:
    """Start a Replicate IDM-VTON prediction and return the prediction ID.

    The call is non-blocking: it creates the prediction asynchronously and
    returns immediately with the prediction ID.  Use :func:`get_tryon_result`
    to poll for completion.
    """
    loop = asyncio.get_event_loop()

    def _create_prediction() -> str:
        client = _get_replicate_client()
        import replicate  # type: ignore[import]

        # Resolve the latest version of the model
        model = client.models.get(_REPLICATE_MODEL)
        version = model.latest_version

        prediction = replicate.predictions.create(
            version=version.id,
            input={
                "human_img": person_image_url,
                "garm_img": clothing_image_url,
                "garment_des": garment_description,
                "is_checked": True,
                "denoise_steps": 30,
                "seed": 42,
            },
        )
        return prediction.id

    try:
        prediction_id: str = await loop.run_in_executor(None, _create_prediction)
        logger.info("Replicate prediction created: %s", prediction_id)
        return prediction_id
    except TryOnError:
        raise
    except Exception as exc:
        logger.exception("Failed to create Replicate prediction")
        raise TryOnError(f"Replicate prediction creation failed: {exc}") from exc


async def get_tryon_result(prediction_id: str) -> Dict[str, Any]:
    """Fetch the current status and output of a Replicate prediction.

    Returns a dict with at minimum:
        - ``status``: one of ``"starting"``, ``"processing"``, ``"succeeded"``, ``"failed"``
        - ``output``: list of output URLs (when status is ``"succeeded"``)
        - ``error``: error message (when status is ``"failed"``)
    """
    loop = asyncio.get_event_loop()

    def _fetch() -> Dict[str, Any]:
        import replicate  # type: ignore[import]

        prediction = replicate.predictions.get(prediction_id)
        result: Dict[str, Any] = {
            "id": prediction.id,
            "status": prediction.status,
            "output": prediction.output,
            "error": prediction.error,
            "created_at": str(prediction.created_at) if prediction.created_at else None,
            "completed_at": str(prediction.completed_at) if getattr(prediction, "completed_at", None) else None,
        }
        return result

    try:
        data: Dict[str, Any] = await loop.run_in_executor(None, _fetch)
        return data
    except TryOnError:
        raise
    except Exception as exc:
        logger.exception("Failed to fetch Replicate prediction %s", prediction_id)
        raise TryOnError(f"Could not retrieve prediction result: {exc}") from exc


async def wait_for_tryon_result(
    prediction_id: str,
    poll_interval: float = 3.0,
    timeout: float = 300.0,
) -> str:
    """Poll until the prediction completes and return the result image URL.

    Raises :class:`~app.utils.errors.TryOnError` on failure or timeout.
    """
    elapsed = 0.0
    while elapsed < timeout:
        data = await get_tryon_result(prediction_id)
        status = data.get("status", "")

        if status == "succeeded":
            output = data.get("output")
            if isinstance(output, list) and output:
                return output[0]
            raise TryOnError("Replicate prediction succeeded but returned no output.")

        if status == "failed":
            error_msg = data.get("error") or "Unknown error"
            raise TryOnError(f"Replicate prediction failed: {error_msg}")

        logger.debug("Prediction %s status=%s – waiting %.0fs …", prediction_id, status, poll_interval)
        await asyncio.sleep(poll_interval)
        elapsed += poll_interval

    raise TryOnError(f"Prediction {prediction_id} timed out after {timeout}s.")
