from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any, AsyncGenerator, Dict

from fastapi import APIRouter, Depends, UploadFile
from sse_starlette.sse import EventSourceResponse  # type: ignore[import]

from app.config import get_settings
from app.dependencies import get_current_user
from app.models.user import UserContext
from app.models.wardrobe import ClothingCategory, ClipAttributes, WardrobeItemResponse
from app.services.classification import classify_clothing
from app.services.segmentation import segment_clothing
from app.services.storage import get_storage_service
from app.utils.errors import AppError, ValidationError
from app.utils.image import (
    bytes_to_image,
    create_thumbnail,
    image_to_bytes,
    resize_image,
    validate_image,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])

# ---------------------------------------------------------------------------
# In-memory job progress store
# ---------------------------------------------------------------------------

# job_id -> {"stage": str, "progress": int, "message": str, "item": dict|None, "error": str|None}
_job_progress: Dict[str, Dict[str, Any]] = {}

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}

_TABLE = "wardrobe_items"


def _get_db():  # type: ignore[return]
    from app.services.supabase import get_supabase_client

    return get_supabase_client()


def _update_job(job_id: str, stage: str, progress: int, message: str, **extra: Any) -> None:
    _job_progress[job_id] = {
        "stage": stage,
        "progress": progress,
        "message": message,
        **extra,
    }


# ---------------------------------------------------------------------------
# Core upload pipeline (runs as a background task)
# ---------------------------------------------------------------------------


async def _run_upload_pipeline(
    job_id: str,
    file_bytes: bytes,
    original_filename: str,
    user: UserContext,
) -> None:
    """Execute the full clothing upload pipeline and update _job_progress."""
    settings = get_settings()
    storage = get_storage_service()
    db = _get_db()
    item_id = str(uuid.uuid4())
    base_path = f"{user.id}/{item_id}"
    bucket = "wardrobe"

    try:
        # ------------------------------------------------------------------ #
        # Stage 1 – Validate                                                  #
        # ------------------------------------------------------------------ #
        _update_job(job_id, "validating", 10, "Validating image…")
        if not validate_image(file_bytes):
            raise ValidationError("Uploaded file is not a valid image.")

        # ------------------------------------------------------------------ #
        # Stage 2 – Upload original                                           #
        # ------------------------------------------------------------------ #
        _update_job(job_id, "uploading_original", 20, "Uploading original image…")
        original_path = f"{base_path}/original.jpg"
        original_url = await storage.upload(
            bucket, original_path, file_bytes, "image/jpeg"
        )

        # ------------------------------------------------------------------ #
        # Stage 3 – Segment                                                   #
        # ------------------------------------------------------------------ #
        _update_job(job_id, "segmenting", 40, "Removing background…")
        segmented_bytes = await segment_clothing(file_bytes)

        # ------------------------------------------------------------------ #
        # Stage 4 – Upload segmented + thumbnail                              #
        # ------------------------------------------------------------------ #
        _update_job(job_id, "uploading_segmented", 55, "Uploading segmented image…")
        segmented_path = f"{base_path}/segmented.png"
        segmented_url = await storage.upload(
            bucket, segmented_path, segmented_bytes, "image/png"
        )

        _update_job(job_id, "creating_thumbnail", 65, "Creating thumbnail…")
        seg_img = bytes_to_image(segmented_bytes)
        thumb_img = create_thumbnail(seg_img, size=256)
        thumb_bytes = image_to_bytes(thumb_img, format="JPEG")
        thumb_path = f"{base_path}/thumbnail.jpg"
        thumbnail_url = await storage.upload(
            bucket, thumb_path, thumb_bytes, "image/jpeg"
        )

        # ------------------------------------------------------------------ #
        # Stage 5 – Classify                                                  #
        # ------------------------------------------------------------------ #
        _update_job(job_id, "classifying", 75, "Classifying clothing…")
        clip_attrs: ClipAttributes = await classify_clothing(segmented_bytes)

        # Determine category from CLIP
        from app.services.classification import _detect_category as _clip_detect_category  # noqa: PLC0415

        category_value: str = ClothingCategory.top.value  # default
        try:
            import io as _io  # noqa: PLC0415
            from PIL import Image as _Image  # noqa: PLC0415

            def _run_detect(img_bytes: bytes) -> str:
                image = _Image.open(_io.BytesIO(img_bytes)).convert("RGB")
                cat, _ = _clip_detect_category(image)
                return cat.value

            loop = asyncio.get_event_loop()
            category_value = await loop.run_in_executor(None, _run_detect, segmented_bytes)
        except Exception as exc:
            logger.warning("Category detection failed, using default 'top': %s", exc)

        # ------------------------------------------------------------------ #
        # Stage 6 – Save to DB                                                #
        # ------------------------------------------------------------------ #
        _update_job(job_id, "saving", 90, "Saving to wardrobe…")
        clip_data = clip_attrs.model_dump()
        row = {
            "id": item_id,
            "user_id": user.id,
            "name": original_filename,
            "category": category_value,
            "original_url": original_url,
            "segmented_url": segmented_url,
            "thumbnail_url": thumbnail_url,
            "attributes": {k: v for k, v in clip_data.items() if k != "confidence"},
            "clip_confidence": clip_data.get("confidence", 0.0),
        }
        db.table(_TABLE).insert(row).execute()

        # Fetch back with timestamps
        saved = (
            db.table(_TABLE)
            .select("*")
            .eq("id", item_id)
            .single()
            .execute()
        )
        item_resp = WardrobeItemResponse(**saved.data)

        _update_job(
            job_id,
            "done",
            100,
            "Upload complete.",
            item=item_resp.model_dump(mode="json"),
        )

    except AppError as exc:
        logger.error("Pipeline error for job %s: %s", job_id, exc)
        _update_job(job_id, "error", 0, exc.detail, error=exc.detail)
    except Exception as exc:
        logger.exception("Unexpected pipeline error for job %s", job_id)
        _update_job(job_id, "error", 0, str(exc), error=str(exc))


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/clothing", status_code=202)
async def upload_clothing(
    file: UploadFile,
    current_user: UserContext = Depends(get_current_user),
) -> Dict[str, str]:
    """Accept a clothing image, validate it, and start the async pipeline.

    Returns a ``job_id`` immediately; poll ``/upload/clothing/{job_id}/status``
    for real-time SSE updates.
    """
    settings = get_settings()

    # ---- Content-type validation ----------------------------------------
    content_type = file.content_type or ""
    if content_type not in _ALLOWED_CONTENT_TYPES:
        raise ValidationError(
            f"Unsupported file type '{content_type}'. "
            f"Allowed: {', '.join(sorted(_ALLOWED_CONTENT_TYPES))}"
        )

    # ---- Size validation -------------------------------------------------
    file_bytes = await file.read()
    if len(file_bytes) > settings.max_file_size_bytes:
        raise ValidationError(
            f"File size {len(file_bytes) / 1_048_576:.1f} MB exceeds the "
            f"{settings.MAX_FILE_SIZE_MB} MB limit."
        )

    job_id = str(uuid.uuid4())
    _update_job(job_id, "queued", 5, "Job queued…")

    # Run pipeline in the background so we can return immediately
    asyncio.create_task(
        _run_upload_pipeline(
            job_id=job_id,
            file_bytes=file_bytes,
            original_filename=file.filename or "upload",
            user=current_user,
        )
    )

    return {"job_id": job_id, "status": "queued"}


@router.get("/clothing/stream/{job_id}")
async def upload_status_stream(
    job_id: str,
    token: str | None = None,
    current_user: UserContext = Depends(get_current_user),
) -> EventSourceResponse:
    """SSE stream of pipeline progress events for *job_id*."""

    async def _event_generator() -> AsyncGenerator[Dict[str, Any], None]:
        while True:
            state = _job_progress.get(job_id)
            if state is None:
                yield {"data": json.dumps({"stage": "unknown", "message": "Job not found"})}
                break

            yield {"data": json.dumps(state)}

            if state["stage"] in ("done", "error"):
                # Optionally clean up after a delay
                await asyncio.sleep(1)
                _job_progress.pop(job_id, None)
                break

            await asyncio.sleep(0.5)

    return EventSourceResponse(_event_generator())
