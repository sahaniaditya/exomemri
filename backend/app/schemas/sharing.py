"""Read-only capture-sharing contracts.

Like the other schema modules, these Pydantic models are the source of truth for
the OpenAPI schema, which generates the extension's TS types
(``extension/src/lib/types.ts`` — never hand-edited).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ProcessingStatus, SourceType


class InviteCollaboratorRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)


class CollaboratorResponse(BaseModel):
    user_id: UUID
    username: str
    full_name: str | None = None
    created_at: datetime | None = None


class CollaboratorListResponse(BaseModel):
    collaborators: list[CollaboratorResponse]


class SharedSourceSummary(BaseModel):
    """One capture shared with the current user — read-only."""

    source_id: UUID
    title: str
    type: SourceType
    url: str | None = None
    author: str | None = None
    captured_at: datetime | None = None
    processing_status: ProcessingStatus
    space_id: UUID
    space_name: str
    owner_username: str | None = None
    shared_at: datetime | None = None


class SharedSourceListResponse(BaseModel):
    sources: list[SharedSourceSummary]


class ShareLinkResponse(BaseModel):
    """Active shareable link for a capture (owner-facing)."""

    token: str
    path: str
    created_at: datetime


class ShareLinkStatusResponse(BaseModel):
    """Whether an active share link exists; includes token for re-copy when enabled."""

    enabled: bool
    token: str | None = None
    path: str | None = None
    created_at: datetime | None = None


class RedeemShareLinkResponse(SharedSourceSummary):
    """Result of redeeming a share link; ``is_owner`` steers the post-redeem redirect."""

    is_owner: bool = False
