"""Learning Space and source-listing contracts.

Like ``schemas/sources.py``, these Pydantic models are the source of truth for
the OpenAPI schema, which in turn generates the extension's TS types
(``extension/src/lib/types.ts`` — never hand-edited).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ProcessingStatus, SourceType


class CreateSpaceRequest(BaseModel):
    """Payload for creating a Learning Space, e.g. ``{"name": "Claude Code"}``."""

    name: str = Field(min_length=2, max_length=200)
    goal_text: str | None = Field(default=None, max_length=2000)


class SourceCounts(BaseModel):
    """Per-type capture counts for a space, as returned by the counts RPC."""

    youtube: int = 0
    article: int = 0
    ai_chat: int = 0
    pdf: int = 0
    note: int = 0
    total: int = 0


class SpaceSummary(BaseModel):
    """A space plus enough aggregate detail to render a dashboard tile."""

    id: UUID
    name: str
    slug: str
    goal_text: str | None = None
    created_at: datetime | None = None
    last_captured_at: datetime | None = None
    source_counts: SourceCounts = SourceCounts()


class SpaceListResponse(BaseModel):
    spaces: list[SpaceSummary]


class SourceSummary(BaseModel):
    """A captured source. ``storage_prefix`` is deliberately not exposed —
    artifacts are reached through ``GET /v1/sources/{id}/artifact-url``."""

    id: UUID
    space_id: UUID
    space_name: str | None = None
    type: SourceType
    title: str
    url: str | None = None
    author: str | None = None
    captured_at: datetime | None = None
    processing_status: ProcessingStatus


class SourceListResponse(BaseModel):
    sources: list[SourceSummary]


class ArtifactUrlResponse(BaseModel):
    """A short-lived signed GET URL for one artifact in the private bucket."""

    url: str
    expires_in: int
