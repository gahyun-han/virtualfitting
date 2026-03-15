from __future__ import annotations

import asyncio
import base64
import json
import logging
import uuid
from typing import Any, AsyncGenerator, Dict, List

from fastapi import APIRouter, BackgroundTasks, Depends

from app.dependencies import get_current_user
from app.models.tryon import TryOnJobCreate, TryOnJobResponse, TryOnStatus
from app.models.user import UserContext
from app.services.storage import get_storage_service
from app.services.tryon import get_tryon_result, run_tryon
from app.utils.errors import AppError, NotFoundError, ValidationError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tryon", tags=["tryon"])

# ---------------------------------------------------------------------------
# In-memory SSE progress store (keyed by job_id)
# ---------------------------------------------------------------------------

_job_events: Dict[str, Dict[str, Any]] = {}

_TABLE = "try_on_jobs"
_WARDROBE_TABLE = "wardrobe_items"


def _get_db():  # type: ignore[return]
    from app.services.supabase import get_supabase_client

    return get_supabase_client()


def _update_event(job_id: str, status: TryOnStatus, message: str, **extra: Any) -> None:
    _job_events[job_id] = {"status": status.value, "message": message, **extra}


# ---------------------------------------------------------------------------
# Background poller
# ---------------------------------------------------------------------------


async def _poll_replicate(job_id: str, prediction_id: str) -> None:
    """Poll Replicate for the prediction result and update the DB + event store."""
    db = _get_db()
    storage = get_storage_service()

    poll_interval = 5.0
    timeout = 300.0
    elapsed = 0.0

    while elapsed < timeout:
        try:
            data = await get_tryon_result(prediction_id)
        except AppError as exc:
            logger.error("Poll error for job %s: %s", job_id, exc)
            _update_event(job_id, TryOnStatus.failed, exc.detail)
            db.table(_TABLE).update(
                {"status": TryOnStatus.failed.value, "error_message": exc.detail}
            ).eq("id", job_id).execute()
            return

        status = data.get("status", "")
        _update_event(job_id, TryOnStatus.processing, f"Prediction status: {status}")

        if status == "succeeded":
            output = data.get("output")
            result_url: str = output[0] if isinstance(output, list) and output else ""

            # Optionally download and re-upload to our own storage
            try:
                import httpx  # type: ignore[import]

                async with httpx.AsyncClient(timeout=60) as client:
                    resp = await client.get(result_url)
                    resp.raise_for_status()
                    stored_url = await storage.upload(
                        "tryon-results",
                        f"{job_id}/result.jpg",
                        resp.content,
                        "image/jpeg",
                    )
            except Exception as exc:
                logger.warning("Could not re-upload result, using Replicate URL: %s", exc)
                stored_url = result_url

            db.table(_TABLE).update(
                {
                    "status": TryOnStatus.completed.value,
                    "result_url": stored_url,
                }
            ).eq("id", job_id).execute()

            _update_event(
                job_id,
                TryOnStatus.completed,
                "Try-on complete.",
                result_url=stored_url,
            )
            return

        if status == "failed":
            error_msg = data.get("error") or "Replicate prediction failed"
            db.table(_TABLE).update(
                {"status": TryOnStatus.failed.value, "error_message": error_msg}
            ).eq("id", job_id).execute()
            _update_event(job_id, TryOnStatus.failed, error_msg)
            return

        await asyncio.sleep(poll_interval)
        elapsed += poll_interval

    # Timeout
    timeout_msg = f"Prediction {prediction_id} timed out after {timeout}s."
    db.table(_TABLE).update(
        {"status": TryOnStatus.failed.value, "error_message": timeout_msg}
    ).eq("id", job_id).execute()
    _update_event(job_id, TryOnStatus.failed, timeout_msg)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("", response_model=Dict[str, str], status_code=202)
async def start_tryon(
    payload: TryOnJobCreate,
    background_tasks: BackgroundTasks,
    current_user: UserContext = Depends(get_current_user),
) -> Dict[str, str]:
    """Start a virtual try-on job.

    - Decodes the base64 person image and uploads it to storage.
    - Retrieves the segmented clothing URL from the wardrobe.
    - Starts a Replicate IDM-VTON prediction.
    - Persists the job to Supabase and starts a background poller.
    - Returns ``{job_id, status: "pending"}`` immediately.
    """
    db = _get_db()
    storage = get_storage_service()
    job_id = str(uuid.uuid4())

    # ---- Decode + upload person image ------------------------------------
    try:
        person_bytes = base64.b64decode(payload.person_image_base64)
    except Exception as exc:
        raise ValidationError(f"Invalid base64 person image: {exc}") from exc

    person_path = f"{current_user.id}/{job_id}/person.jpg"
    person_url = await storage.upload("tryon-inputs", person_path, person_bytes, "image/jpeg")

    # ---- Get clothing segmented URL -------------------------------------
    wardrobe_resp = (
        db.table(_WARDROBE_TABLE)
        .select("segmented_url, clip_attributes, name")
        .eq("id", str(payload.wardrobe_item_id))
        .eq("user_id", current_user.id)
        .maybe_single()
        .execute()
    )
    if not wardrobe_resp.data:
        raise NotFoundError(f"Wardrobe item {payload.wardrobe_item_id} not found.")

    clothing_url: str = wardrobe_resp.data.get("segmented_url") or wardrobe_resp.data.get("original_url", "")
    clip_attrs = wardrobe_resp.data.get("clip_attributes") or {}
    garment_desc = (
        f"{clip_attrs.get('style', '')} {clip_attrs.get('color', '')} "
        f"{clip_attrs.get('pattern', '')} clothing"
    ).strip()
    if not garment_desc:
        garment_desc = wardrobe_resp.data.get("name") or "clothing item"

    # ---- Start Replicate prediction -------------------------------------
    prediction_id = await run_tryon(
        person_image_url=person_url,
        clothing_image_url=clothing_url,
        garment_description=garment_desc,
    )

    # ---- Persist job to DB ----------------------------------------------
    db.table(_TABLE).insert(
        {
            "id": job_id,
            "user_id": current_user.id,
            "wardrobe_item_id": str(payload.wardrobe_item_id),
            "status": TryOnStatus.pending.value,
            "replicate_prediction_id": prediction_id,
            "person_image_url": person_url,
        }
    ).execute()

    # ---- Start background poller ----------------------------------------
    _update_event(job_id, TryOnStatus.pending, "Job queued.")
    background_tasks.add_task(_poll_replicate, job_id, prediction_id)

    return {"job_id": job_id, "status": TryOnStatus.pending.value}


@router.get("/history", response_model=List[TryOnJobResponse])
async def list_tryon_history(
    current_user: UserContext = Depends(get_current_user),
) -> List[TryOnJobResponse]:
    """Return all try-on jobs for the current user, newest first."""
    db = _get_db()
    response = (
        db.table(_TABLE)
        .select("*")
        .eq("user_id", current_user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return [TryOnJobResponse(**row) for row in (response.data or [])]


@router.get("/{job_id}", response_model=TryOnJobResponse)
async def get_tryon_job(
    job_id: str,
    current_user: UserContext = Depends(get_current_user),
) -> TryOnJobResponse:
    """Poll the status of a try-on job."""
    db = _get_db()
    response = (
        db.table(_TABLE)
        .select("*")
        .eq("id", job_id)
        .eq("user_id", current_user.id)
        .maybe_single()
        .execute()
    )
    if not response.data:
        raise NotFoundError(f"Try-on job {job_id} not found.")
    return TryOnJobResponse(**response.data)


@router.get("/{job_id}/stream")
async def tryon_stream(
    job_id: str,
    current_user: UserContext = Depends(get_current_user),
) -> Any:
    """SSE stream for real-time try-on job updates."""
    from sse_starlette.sse import EventSourceResponse  # type: ignore[import]

    async def _generator() -> AsyncGenerator[Dict[str, Any], None]:
        while True:
            state = _job_events.get(job_id)
            if state is None:
                yield {"data": json.dumps({"status": "unknown", "message": "Job not found or expired"})}
                break

            yield {"data": json.dumps(state)}

            if state.get("status") in (TryOnStatus.completed.value, TryOnStatus.failed.value):
                await asyncio.sleep(1)
                _job_events.pop(job_id, None)
                break

            await asyncio.sleep(1)

    return EventSourceResponse(_generator())


@router.delete("/{job_id}", status_code=204)
async def delete_tryon_job(
    job_id: str,
    current_user: UserContext = Depends(get_current_user),
) -> None:
    """Delete a try-on job record."""
    db = _get_db()
    existing = (
        db.table(_TABLE)
        .select("id")
        .eq("id", job_id)
        .eq("user_id", current_user.id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise NotFoundError(f"Try-on job {job_id} not found.")
    db.table(_TABLE).delete().eq("id", job_id).eq("user_id", current_user.id).execute()
    _job_events.pop(job_id, None)
