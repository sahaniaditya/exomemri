"""Schemas for per-capture named note pages (TipTap JSON)."""

from __future__ import annotations

from typing import Any, Self
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

DEFAULT_NOTE_TITLE = "Untitled"
MAX_NOTE_TITLE_LENGTH = 120
MAX_PAGES_PER_SOURCE = 50


class NotePageResponse(BaseModel):
    """One named notebook page on a capture."""

    id: UUID
    source_id: UUID
    title: str
    content: dict[str, Any] = Field(default_factory=dict)
    sort_order: int
    updated_at: str | None = None


class NotePageListResponse(BaseModel):
    """All notebook pages on a capture, ordered by ``sort_order``."""

    items: list[NotePageResponse] = Field(default_factory=list)


class CreateNotePageRequest(BaseModel):
    """Create a blank page. Title defaults to Untitled."""

    title: str = Field(
        default=DEFAULT_NOTE_TITLE,
        min_length=1,
        max_length=MAX_NOTE_TITLE_LENGTH,
    )

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Title cannot be empty.")
        return stripped


class UpdateNotePageRequest(BaseModel):
    """Replace the page title and/or TipTap document. At least one is required."""

    title: str | None = Field(default=None, min_length=1, max_length=MAX_NOTE_TITLE_LENGTH)
    content: dict[str, Any] | None = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("Title cannot be empty.")
        return stripped

    @model_validator(mode="after")
    def require_title_or_content(self) -> Self:
        if self.title is None and self.content is None:
            raise ValueError("Provide title and/or content.")
        return self


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
