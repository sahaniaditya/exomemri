"""Schemas for note version history (snapshots of a space note)."""

from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

MAX_VERSIONS_PER_NOTE = 50

# Reasons a client may request. ``pre_restore`` is server-only.
ClientVersionReason = Literal["idle", "manual"]
VersionReason = Literal["idle", "manual", "pre_restore"]


class CreateNoteVersionRequest(BaseModel):
    reason: ClientVersionReason = "idle"


class NoteVersionSummary(BaseModel):
    """A version without its content, for listings."""

    id: UUID
    title: str
    reason: VersionReason
    created_at: str


class NoteVersionListResponse(BaseModel):
    items: list[NoteVersionSummary] = Field(default_factory=list)


class NoteVersionResponse(NoteVersionSummary):
    content: dict[str, Any] = Field(default_factory=dict)
