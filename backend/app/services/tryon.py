from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from typing import Any, Dict

import httpx

from app.utils.errors import TryOnError

logger = logging.getLogger(__name__)

# HF Space fallbacks (used only when fal.ai is unavailable)
# Each entry: (space_id, needs_area_param)
_HF_SPACES = [
    ("yisol/IDM-VTON", False),
    ("jjlealse/IDM-VTON", True),
    ("alf0nso/IDM-VTON-demo2", True),
]


def _category_to_area(category: str) -> str:
    """Map clothing category to IDM-VTON area string."""
    if category in ("bottom",):
        return "lower_body"
    if category in ("dress",):
        return "dresses"
    return "upper_body"


def _run_fal(
    person_image_bytes: bytes,
    clothing_image_url: str,
    garment_description: str,
    category: str = "top",
) -> bytes:
    """Run IDM-VTON via fal.ai (primary)."""
    import fal_client  # type: ignore[import]

    logger.info("Uploading person image to fal.ai storage …")
    person_url = fal_client.upload(person_image_bytes, "image/jpeg")

    area = _category_to_area(category)
    logger.info("Calling fal-ai/idm-vton (area=%s) …", area)
    result = fal_client.subscribe(
        "fal-ai/idm-vton",
        arguments={
            "human_image_url": person_url,
            "garment_image_url": clothing_image_url,
            "description": garment_description,
            "category": area,
            "num_inference_steps": 30,
            "seed": 42,
        },
    )

    output_url: str = result["image"]["url"]
    logger.info("fal.ai try-on completed, downloading result …")
    with httpx.Client(timeout=60) as http:
        r = http.get(output_url)
        r.raise_for_status()
        return r.content


def _run_hf_space(space: str, needs_area: bool, person_image_bytes: bytes, clothing_image_url: str, garment_description: str, category: str = "top") -> bytes:
    """Run IDM-VTON via a HuggingFace Gradio Space (fallback)."""
    from gradio_client import Client, handle_file  # type: ignore[import]

    with tempfile.TemporaryDirectory() as tmpdir:
        person_path = os.path.join(tmpdir, "person.jpg")
        clothing_path = os.path.join(tmpdir, "clothing.jpg")

        with open(person_path, "wb") as f:
            f.write(person_image_bytes)

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

        logger.info("Connecting to HuggingFace Space %s …", space)
        client = Client(space)

        kwargs: Dict[str, Any] = dict(
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
        area = _category_to_area(category)
        # Always pass area for non-upper-body; also pass when space requires it
        if needs_area or area != "upper_body":
            kwargs["area"] = area

        result = client.predict(**kwargs)

        result_path = result[0] if isinstance(result, (list, tuple)) else result
        with open(result_path, "rb") as f:
            return f.read()


async def run_tryon(
    person_image_bytes: bytes,
    clothing_image_url: str,
    garment_description: str,
    category: str = "top",
) -> bytes:
    """Run IDM-VTON: fal.ai first, HuggingFace Spaces as fallback."""
    loop = asyncio.get_event_loop()

    def _run() -> bytes:
        from app.config import get_settings
        settings = get_settings()

        # --- Primary: fal.ai ---
        if settings.FAL_KEY:
            os.environ["FAL_KEY"] = settings.FAL_KEY
            try:
                return _run_fal(person_image_bytes, clothing_image_url, garment_description, category)
            except Exception as exc:
                logger.warning("fal.ai failed, falling back to HF Spaces: %s", exc)

        # --- Fallback: HuggingFace Spaces ---
        area = _category_to_area(category)
        last: Exception = RuntimeError("No try-on backends available")
        for space, needs_area in _HF_SPACES:
            # Skip spaces that don't support area param when non-upper-body is needed
            if not needs_area and area != "upper_body":
                logger.info("Skipping %s (no area support) for category=%s", space, category)
                continue
            try:
                return _run_hf_space(space, needs_area, person_image_bytes, clothing_image_url, garment_description, category)
            except Exception as exc:
                logger.warning("Space %s failed: %s", space, exc)
                last = exc
        raise last

    try:
        result_bytes: bytes = await loop.run_in_executor(None, _run)
        logger.info("Try-on completed successfully.")
        return result_bytes
    except TryOnError:
        raise
    except Exception as exc:
        logger.error("Try-on failed: %s", exc)
        raise TryOnError(f"Try-on failed: {exc}") from exc


async def get_tryon_result(prediction_id: str) -> Dict[str, Any]:
    """Unused stub kept for import compatibility."""
    return {}
