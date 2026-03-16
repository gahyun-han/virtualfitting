from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Any


class ClothingCategory(str, Enum):
    top = "top"
    bottom = "bottom"
    dress = "dress"
    shoes = "shoes"
    outerwear = "outerwear"
    accessory = "accessory"


class ClipAttributes(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    color: str = ""
    style: str = ""
    pattern: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class WardrobeItemCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = None
    category: Optional[ClothingCategory] = None


class WardrobeItemUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = None
    category: Optional[ClothingCategory] = None


class WardrobeItemResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: UUID
    user_id: str
    name: Optional[str] = None
    category: Optional[ClothingCategory] = None

    # Storage URLs
    original_url: Optional[str] = None
    segmented_url: Optional[str] = None
    thumbnail_url: Optional[str] = None

    # CLIP attributes
    clip_attributes: Optional[ClipAttributes] = None

    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def _map_db_fields(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        # Map DB columns (attributes + clip_confidence) → clip_attributes
        if "clip_attributes" not in data or data.get("clip_attributes") is None:
            attrs = data.get("attributes") or {}
            confidence = data.get("clip_confidence") or 0.0
            if attrs or confidence:
                data["clip_attributes"] = {**attrs, "confidence": confidence}
        return data
