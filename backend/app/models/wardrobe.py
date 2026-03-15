from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


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
