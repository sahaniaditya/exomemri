"""Read-only space-sharing contracts.

Like the other schema modules, these Pydantic models are the source of truth for
the OpenAPI schema, which generates the extension's TS types
(``extension/src/lib/types.ts`` — never hand-edited).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class InviteCollaboratorRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)


class CollaboratorResponse(BaseModel):
    user_id: UUID
    username: str
    full_name: str | None = None
    created_at: datetime | None = None


class CollaboratorListResponse(BaseModel):
    collaborators: list[CollaboratorResponse]


class SharedSpaceSummary(BaseModel):
    """One space shared with the current user — read-only, curated content only."""

    id: UUID
    name: str
    slug: str
    owner_username: str | None = None
    shared_at: datetime | None = None


class SharedSpaceListResponse(BaseModel):
    spaces: list[SharedSpaceSummary]
