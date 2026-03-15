from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class UserContext(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    email: str
