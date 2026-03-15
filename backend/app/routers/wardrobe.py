from __future__ import annotations

import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.dependencies import get_current_user
from app.models.user import UserContext
from app.models.wardrobe import ClothingCategory, WardrobeItemResponse, WardrobeItemUpdate
from app.services.storage import get_storage_service
from app.utils.errors import NotFoundError, StorageError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/wardrobe", tags=["wardrobe"])

# ---------------------------------------------------------------------------
# Supabase table name
# ---------------------------------------------------------------------------

_TABLE = "wardrobe_items"


def _get_db():  # type: ignore[return]
    from app.services.supabase import get_supabase_client

    return get_supabase_client()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=List[WardrobeItemResponse])
async def list_wardrobe_items(
    category: Optional[ClothingCategory] = Query(None, description="Filter by clothing category"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: UserContext = Depends(get_current_user),
) -> List[WardrobeItemResponse]:
    """Return a paginated list of wardrobe items owned by the current user."""
    db = _get_db()
    offset = (page - 1) * limit

    query = db.table(_TABLE).select("*").eq("user_id", current_user.id)

    if category is not None:
        query = query.eq("category", category.value)

    response = (
        query.order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return [WardrobeItemResponse(**row) for row in (response.data or [])]


@router.get("/{item_id}", response_model=WardrobeItemResponse)
async def get_wardrobe_item(
    item_id: UUID,
    current_user: UserContext = Depends(get_current_user),
) -> WardrobeItemResponse:
    """Return a single wardrobe item by ID."""
    db = _get_db()
    response = (
        db.table(_TABLE)
        .select("*")
        .eq("id", str(item_id))
        .eq("user_id", current_user.id)
        .maybe_single()
        .execute()
    )

    if not response.data:
        raise NotFoundError(f"Wardrobe item {item_id} not found.")

    return WardrobeItemResponse(**response.data)


@router.patch("/{item_id}", response_model=WardrobeItemResponse)
async def update_wardrobe_item(
    item_id: UUID,
    payload: WardrobeItemUpdate,
    current_user: UserContext = Depends(get_current_user),
) -> WardrobeItemResponse:
    """Update name and/or category of a wardrobe item."""
    db = _get_db()

    # Verify ownership first
    existing = (
        db.table(_TABLE)
        .select("id")
        .eq("id", str(item_id))
        .eq("user_id", current_user.id)
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise NotFoundError(f"Wardrobe item {item_id} not found.")

    updates = payload.model_dump(exclude_none=True)
    if not updates:
        # Nothing to update – return current state
        return await get_wardrobe_item(item_id, current_user)

    # Serialise enum values to strings for Supabase
    if "category" in updates and isinstance(updates["category"], ClothingCategory):
        updates["category"] = updates["category"].value

    response = (
        db.table(_TABLE)
        .update(updates)
        .eq("id", str(item_id))
        .eq("user_id", current_user.id)
        .execute()
    )

    if not response.data:
        raise NotFoundError(f"Wardrobe item {item_id} not found after update.")

    return WardrobeItemResponse(**response.data[0])


@router.delete("/{item_id}", status_code=204)
async def delete_wardrobe_item(
    item_id: UUID,
    current_user: UserContext = Depends(get_current_user),
) -> None:
    """Delete a wardrobe item and its associated storage objects."""
    db = _get_db()

    # Fetch item to get storage paths
    response = (
        db.table(_TABLE)
        .select("*")
        .eq("id", str(item_id))
        .eq("user_id", current_user.id)
        .maybe_single()
        .execute()
    )
    if not response.data:
        raise NotFoundError(f"Wardrobe item {item_id} not found.")

    item = response.data
    storage = get_storage_service()
    bucket = "wardrobe"

    # Best-effort deletion from storage (don't fail if objects are missing)
    for url_field, path_suffix in [
        ("original_url", "original"),
        ("segmented_url", "segmented"),
        ("thumbnail_url", "thumbnail"),
    ]:
        url: Optional[str] = item.get(url_field)
        if url:
            # Extract the storage path from the URL by convention
            path = f"{current_user.id}/{item_id}/{path_suffix}"
            try:
                await storage.delete(bucket, path)
            except StorageError as exc:
                logger.warning("Could not delete storage object %s: %s", path, exc)

    # Delete DB record
    db.table(_TABLE).delete().eq("id", str(item_id)).eq("user_id", current_user.id).execute()
