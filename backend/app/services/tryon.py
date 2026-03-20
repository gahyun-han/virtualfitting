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

# fal.ai FASHN category values (supports full-body for dress)
_FASHN_CATEGORY: Dict[str, str] = {
    "top": "upper-body",
    "outerwear": "upper-body",
    "bottom": "lower-body",
    "dress": "full-body",
}


def _category_to_area(category: str) -> str:
    """Map clothing category to IDM-VTON area string."""
    if category == "bottom":
        return "lower_body"
    if category == "dress":
        return "dresses"
    return "upper_body"


def _run_fal_fashn(
    person_image_bytes: bytes,
    clothing_image_url: str,
    garment_description: str,
    category: str,
) -> bytes:
    """Run FASHN v1.5 via fal.ai — supports upper/lower/full-body categories."""
    import fal_client  # type: ignore[import]

    fashn_category = _FASHN_CATEGORY.get(category, "upper-body")
    logger.info("Uploading person image to fal.ai storage (FASHN) …")
    person_url = fal_client.upload(person_image_bytes, "image/jpeg")

    logger.info("Downloading clothing image for fal.ai upload …")
    with httpx.Client(timeout=60) as http:
        r = http.get(clothing_image_url)
        r.raise_for_status()
        clothing_bytes = r.content
    clothing_url = fal_client.upload(clothing_bytes, "image/png")

    logger.info("Calling fal-ai/fashn/tryon/v1.5 (category=%s) …", fashn_category)
    result = fal_client.subscribe(
        "fal-ai/fashn/tryon/v1.5",
        arguments={
            "model_image": person_url,
            "garment_image": clothing_url,
            "category": fashn_category,
        },
    )

    logger.info("FASHN raw result keys: %s", list(result.keys()) if isinstance(result, dict) else type(result))
    output = result.get("images") or result.get("image") or result.get("output")
    if isinstance(output, list) and output:
        first = output[0]
        output_url: str = first["url"] if isinstance(first, dict) else str(first)
    elif isinstance(output, dict):
        output_url = output["url"]
    elif isinstance(output, str):
        output_url = output
    else:
        raise TryOnError(f"Unexpected FASHN response format: {result}")

    logger.info("fal.ai FASHN completed, downloading result …")
    with httpx.Client(timeout=60) as http:
        r = http.get(output_url)
        r.raise_for_status()
        return r.content


def _run_fal_idmvton(
    person_image_bytes: bytes,
    clothing_image_url: str,
    garment_description: str,
) -> bytes:
    """Run IDM-VTON via fal.ai — upper body only, but free."""
    import fal_client  # type: ignore[import]

    logger.info("Uploading person image to fal.ai storage (IDM-VTON) …")
    person_url = fal_client.upload(person_image_bytes, "image/jpeg")

    logger.info("Downloading clothing image for fal.ai upload …")
    with httpx.Client(timeout=60) as http:
        r = http.get(clothing_image_url)
        r.raise_for_status()
        clothing_bytes = r.content
    clothing_url = fal_client.upload(clothing_bytes, "image/png")

    logger.info("Calling fal-ai/idm-vton …")
    result = fal_client.subscribe(
        "fal-ai/idm-vton",
        arguments={
            "human_image_url": person_url,
            "garment_image_url": clothing_url,
            "description": garment_description,
            "num_inference_steps": 30,
            "seed": 42,
        },
    )

    output_url: str = result["image"]["url"]
    logger.info("fal.ai IDM-VTON completed, downloading result …")
    with httpx.Client(timeout=60) as http:
        r = http.get(output_url)
        r.raise_for_status()
        return r.content


def _run_hf_space(
    space: str,
    needs_area: bool,
    person_image_bytes: bytes,
    clothing_image_url: str,
    garment_description: str,
    category: str = "top",
) -> bytes:
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
        if needs_area or area != "upper_body":
            kwargs["area"] = area

        result = client.predict(**kwargs)

        result_path = result[0] if isinstance(result, (list, tuple)) else result
        with open(result_path, "rb") as f:
            return f.read()


def _run_hf_spaces(
    person_image_bytes: bytes,
    clothing_image_url: str,
    garment_description: str,
    category: str,
) -> bytes:
    """Try all HF Spaces for a single pass."""
    area = _category_to_area(category)
    last: Exception = RuntimeError("No try-on backends available")
    for space, needs_area in _HF_SPACES:
        # yisol silently ignores area param and always does upper_body.
        # Skip it for anything that requires a specific area.
        if not needs_area and area != "upper_body":
            logger.info("Skipping %s (ignores area=%s)", space, area)
            continue
        try:
            return _run_hf_space(space, needs_area, person_image_bytes, clothing_image_url, garment_description, category)
        except Exception as exc:
            logger.warning("Space %s failed: %s", space, exc)
            last = exc
    raise last


async def run_tryon(
    person_image_bytes: bytes,
    clothing_image_url: str,
    garment_description: str,
    category: str = "top",
) -> bytes:
    """Run virtual try-on.

    fal.ai path:
    - dress / bottom: FASHN v1.5 (supports full-body / lower-body, $0.075/image)
    - top / outerwear: IDM-VTON (upper-body only, free)

    HF Space fallback:
    - dress: 2-pass (upper_body then lower_body via yisol)
    - others: single pass
    """
    loop = asyncio.get_event_loop()

    def _run() -> bytes:
        from app.config import get_settings
        settings = get_settings()

        if settings.FAL_KEY:
            os.environ["FAL_KEY"] = settings.FAL_KEY
            try:
                # dress / bottom need FASHN (supports category selection)
                if category in ("dress", "bottom"):
                    return _run_fal_fashn(
                        person_image_bytes, clothing_image_url, garment_description, category
                    )
                # top / outerwear: IDM-VTON is free and works fine
                return _run_fal_idmvton(
                    person_image_bytes, clothing_image_url, garment_description
                )
            except Exception as exc:
                logger.warning("fal.ai failed, falling back to HF Spaces: %s", exc)

        # --- HF Space fallback ---
        # Dress: 2-pass since HF Spaces don't reliably support "dresses" area
        if category == "dress":
            logger.info("Dress on HF Space: running 2-pass (upper + lower body)")
            result = _run_hf_spaces(person_image_bytes, clothing_image_url, garment_description, "top")
            return _run_hf_spaces(result, clothing_image_url, garment_description, "bottom")

        return _run_hf_spaces(person_image_bytes, clothing_image_url, garment_description, category)

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
