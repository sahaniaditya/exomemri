"""Schemas for per-capture user notes (TipTap JSON notebook)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class NoteResponse(BaseModel):
    """The notebook for one source. Empty content when the user has never saved."""

    source_id: UUID
    content: dict[str, Any] = Field(default_factory=dict)
    updated_at: str | None = None


class UpsertNoteRequest(BaseModel):
    """Replace the notebook document for a source."""

    content: dict[str, Any] = Field(default_factory=dict)


class NoteImageUploadRequest(BaseModel):
    """Ask for a signed PUT URL for a note image under the source prefix."""

    content_type: str = Field(min_length=1, max_length=100)
    filename: str = Field(min_length=1, max_length=255)


class NoteImageUploadResponse(BaseModel):
    """Client PUTs bytes to ``upload_url`` with header ``x-upsert: true``."""

    key: str
    upload_url: str
    token: str
    path: str
