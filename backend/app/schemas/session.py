"""Session endpoint contracts."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import Space, User


class SessionResponse(BaseModel):
    """Current user + the active learning space (may be null)."""

    user: User
    active_space: Space | None = None


class SetActiveSpaceRequest(BaseModel):
    space_id: UUID
