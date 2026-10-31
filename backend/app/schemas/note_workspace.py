"""Schemas for the notes workspace: page tree, trash, search, links, page patching."""

from __future__ import annotations

from typing import Any, Literal, Self
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.notes import DEFAULT_NOTE_TITLE, MAX_NOTE_TITLE_LENGTH

# The legacy create path keeps MAX_PAGES_PER_SCOPE (50); the workspace path allows more.
MAX_WORKSPACE_PAGES = 500
TRASH_RETENTION_DAYS = 30
SEARCH_RESULT_LIMIT = 20
MAX_ICON_LENGTH = 16
MAX_COVER_KEY_LENGTH = 200


def _clean_title(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    if not stripped:
        raise ValueError("Title cannot be empty.")
    return stripped


class WorkspacePageResponse(BaseModel):
    """One note page with its content and workspace fields."""

    id: UUID
    space_id: UUID
    title: str
    content: dict[str, Any] = Field(default_factory=dict)
    icon: str | None = None
    cover_key: str | None = None
    full_width: bool = False
    parent_id: UUID | None = None
    sort_order: int
    created_at: str | None = None
    updated_at: str | None = None


class NoteTreeItem(BaseModel):
    """A page in the sidebar tree (no content)."""

    id: UUID
    title: str
    icon: str | None = None
    parent_id: UUID | None = None
    sort_order: int
    updated_at: str | None = None


class NoteTreeResponse(BaseModel):
    items: list[NoteTreeItem] = Field(default_factory=list)


class NoteTrashItem(BaseModel):
    id: UUID
    title: str
    icon: str | None = None
    parent_id: UUID | None = None
    deleted_at: str | None = None


class NoteTrashResponse(BaseModel):
    items: list[NoteTrashItem] = Field(default_factory=list)


class NoteSearchHit(BaseModel):
    id: UUID
    title: str
    icon: str | None = None
    snippet: str = ""


class NoteSearchResponse(BaseModel):
    items: list[NoteSearchHit] = Field(default_factory=list)


class CreateWorkspacePageRequest(BaseModel):
    """Create a blank page, optionally under a root page."""

    title: str = Field(
        default=DEFAULT_NOTE_TITLE, min_length=1, max_length=MAX_NOTE_TITLE_LENGTH
    )
    parent_id: UUID | None = None

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str) -> str:
        return _clean_title(value) or DEFAULT_NOTE_TITLE


class PatchNotePageRequest(BaseModel):
    """Partial update. Fields that are omitted are untouched; ``null`` clears the nullable ones."""

    title: str | None = Field(default=None, min_length=1, max_length=MAX_NOTE_TITLE_LENGTH)
    content: dict[str, Any] | None = None
    icon: str | None = Field(default=None, max_length=MAX_ICON_LENGTH)
    cover_key: str | None = Field(default=None, max_length=MAX_COVER_KEY_LENGTH)
    full_width: bool | None = None
    parent_id: UUID | None = None
    sort_order: int | None = Field(default=None, ge=0, le=1_000_000)
    expected_updated_at: str | None = Field(default=None, max_length=64)

    @field_validator("title")
    @classmethod
    def strip_title(cls, value: str | None) -> str | None:
        return _clean_title(value)

    @model_validator(mode="after")
    def require_a_change(self) -> Self:
        changes = self.model_fields_set - {"expected_updated_at"}
        if not changes:
            raise ValueError("Provide at least one field to change.")
        for field in ("title", "content", "full_width", "sort_order"):
            if field in changes and getattr(self, field) is None:
                raise ValueError(f"{field} cannot be null.")
        return self


class OutgoingNoteLink(BaseModel):
    type: Literal["source", "note"]
    id: UUID
    title: str


class IncomingNoteLink(BaseModel):
    id: UUID
    title: str
    icon: str | None = None


class NoteLinksResponse(BaseModel):
    outgoing: list[OutgoingNoteLink] = Field(default_factory=list)
    incoming: list[IncomingNoteLink] = Field(default_factory=list)
