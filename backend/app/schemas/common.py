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
    """Lifecycle of a captured source through the RAG pipeline.

    Capture inserts ``queued``. The background pipeline advances through
    fetching → chunking → embedding → summarizing → extracting, then
    ``ready``. Any stage error lands on ``failed``.
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
    """The authenticated user."""

    id: UUID
    email: str


class Space(BaseModel):
    """A goal-scoped Learning Space (the identity slice embedded in a session)."""

    id: UUID
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = None


class ErrorDetail(BaseModel):
    code: str
    message: str
    detail: dict | None = None


class ErrorEnvelope(BaseModel):
    """Uniform error response body: ``{"error": {...}}``."""

    error: ErrorDetail
