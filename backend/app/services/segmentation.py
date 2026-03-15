from __future__ import annotations

import asyncio
import io
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

from PIL import Image, ImageFilter

from app.utils.errors import SegmentationError
from app.utils.image import image_to_bytes

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level singletons (populated during lifespan startup)
# ---------------------------------------------------------------------------

_session: Optional[object] = None  # rembg.Session
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="rembg")


# ---------------------------------------------------------------------------
# Startup / teardown
# ---------------------------------------------------------------------------


def load_rembg_session(model_name: str = "u2net") -> None:
    """Load the rembg session.  Call once at application startup."""
    global _session
    try:
        from rembg import new_session  # type: ignore[import]

        _session = new_session(model_name)
        logger.info("rembg session loaded (model=%s)", model_name)
    except Exception as exc:
        logger.error("Failed to load rembg session: %s", exc)
        raise SegmentationError(f"rembg session init failed: {exc}") from exc


def get_rembg_session() -> object:
    if _session is None:
        raise SegmentationError("rembg session has not been initialised. Call load_rembg_session() at startup.")
    return _session


# ---------------------------------------------------------------------------
# Synchronous core (runs inside the thread-pool)
# ---------------------------------------------------------------------------


def _run_segmentation(image_bytes: bytes) -> bytes:
    """CPU-bound rembg inference + alpha-channel edge smoothing."""
    from rembg import remove  # type: ignore[import]

    session = get_rembg_session()

    # 1. Remove background
    output_bytes: bytes = remove(image_bytes, session=session)

    # 2. Load result as PIL RGBA image
    img = Image.open(io.BytesIO(output_bytes)).convert("RGBA")

    # 3. Edge smoothing: apply a slight Gaussian blur to the alpha channel only
    r, g, b, alpha = img.split()
    alpha_smooth = alpha.filter(ImageFilter.GaussianBlur(radius=1.5))
    img = Image.merge("RGBA", (r, g, b, alpha_smooth))

    # 4. Encode back to PNG bytes
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Public async API
# ---------------------------------------------------------------------------


async def segment_clothing(image_bytes: bytes) -> bytes:
    """Remove the background from a clothing image and return RGBA PNG bytes.

    The rembg inference is dispatched to a thread-pool so the async event
    loop is never blocked.
    """
    loop = asyncio.get_event_loop()
    try:
        result: bytes = await loop.run_in_executor(
            _executor,
            _run_segmentation,
            image_bytes,
        )
        return result
    except SegmentationError:
        raise
    except Exception as exc:
        logger.exception("Segmentation failed")
        raise SegmentationError(f"Background removal failed: {exc}") from exc
