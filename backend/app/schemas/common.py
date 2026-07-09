"""Shared enums and models used across the API contract."""

from __future__ import annotations

from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field


class SourceType(StrEnum):
    """The kind of artifact being captured."""

    youtube = "youtube"
    article = "article"
    ai_chat = "ai_chat"
    pdf = "pdf"
    note = "note"


class ProcessingStatus(StrEnum):
    """Lifecycle of a source.

    Phase 0 only ever emits ``queued`` (nothing processes it yet); the full
    set is declared here so the generated client contract is stable across
    phases.
    """

    queued = "queued"
    fetching = "fetching"
    chunking = "chunking"
    embedding = "embedding"
    summarizing = "summarizing"
    extracting = "extracting"
    ready = "ready"
    failed = "failed"


class User(BaseModel):
    """The authenticated user (Phase 0: a fixed dev user)."""

    id: UUID
    email: str


class Space(BaseModel):
    """A goal-scoped Learning Space."""

    id: UUID
    name: str = Field(min_length=1, max_length=200)


class ErrorDetail(BaseModel):
    code: str
    message: str
    detail: dict | None = None


class ErrorEnvelope(BaseModel):
    """Uniform error response body: ``{"error": {...}}``."""

    error: ErrorDetail
