from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from typing import Any, Dict

import httpx

from app.utils.errors import TryOnError

logger = logging.getLogger(__name__)

_HF_SPACE = "yisol/IDM-VTON"


async def run_tryon(
    person_image_bytes: bytes,
    clothing_image_url: str,
    garment_description: str,
) -> bytes:
    """Run IDM-VTON via HuggingFace Space.

    Accepts person image as bytes (avoids private-bucket auth issues).
    Downloads clothing image from URL (public bucket), calls the Gradio
    Space, and returns the result image as bytes.
    """
    loop = asyncio.get_event_loop()

    def _run() -> bytes:
        from gradio_client import Client, handle_file  # type: ignore[import]

        with tempfile.TemporaryDirectory() as tmpdir:
            person_path = os.path.join(tmpdir, "person.jpg")
            clothing_path = os.path.join(tmpdir, "clothing.jpg")

            # Write person bytes directly
            with open(person_path, "wb") as f:
                f.write(person_image_bytes)

            # Download clothing image
            with httpx.Client(timeout=60) as http:
                r = http.get(clothing_image_url)
                r.raise_for_status()
                with open(clothing_path, "wb") as f:
                    f.write(r.content)

            from app.config import get_settings
            hf_token = get_settings().HF_TOKEN
            if hf_token:
                from huggingface_hub import login  # type: ignore[import]
                login(token=hf_token)
            logger.info("Connecting to HuggingFace Space %s …", _HF_SPACE)
            client = Client(_HF_SPACE)

            result = client.predict(
                dict={
                    "background": handle_file(person_path),
                    "layers": [],
                    "composite": None,
                },
                garm_img=handle_file(clothing_path),
                garment_des=garment_description,
                is_checked=True,
                is_checked_crop=False,
                denoise_steps=30,
                seed=42,
                api_name="/tryon",
            )

            # result is (output_image_path, masked_image_path)
            result_path = result[0] if isinstance(result, (list, tuple)) else result
            with open(result_path, "rb") as f:
                return f.read()

    max_retries = 3
    last_exc: Exception = RuntimeError("Unknown error")
    for attempt in range(1, max_retries + 1):
        try:
            result_bytes: bytes = await loop.run_in_executor(None, _run)
            logger.info("HuggingFace try-on completed successfully.")
            return result_bytes
        except TryOnError:
            raise
        except Exception as exc:
            last_exc = exc
            logger.warning("HuggingFace try-on attempt %d/%d failed: %s", attempt, max_retries, exc)
            if attempt < max_retries:
                await asyncio.sleep(10)  # wait before retry

    logger.error("HuggingFace try-on failed after %d attempts", max_retries)
    raise TryOnError(f"HuggingFace try-on failed: {last_exc}") from last_exc


async def get_tryon_result(prediction_id: str) -> Dict[str, Any]:
    """Unused stub kept for import compatibility."""
    return {}
