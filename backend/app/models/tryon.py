from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TryOnStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class TryOnJobCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    wardrobe_item_id: UUID
    person_image_base64: str  # base64-encoded image


class TryOnJobResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

    id: UUID
    user_id: str
    wardrobe_item_id: UUID
    status: TryOnStatus
    replicate_prediction_id: Optional[str] = None

    # Storage references
    person_image_url: Optional[str] = None
    result_url: Optional[str] = None

    error_message: Optional[str] = None

    created_at: datetime
    updated_at: datetime
