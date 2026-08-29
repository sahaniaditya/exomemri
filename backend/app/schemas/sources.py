"""Source capture endpoint contracts.

These Pydantic models are the single source of truth for the OpenAPI schema,
which is in turn the source of truth for the extension's generated TS types
(``extension/src/lib/types.ts``). Do not hand-edit the generated types.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl

from app.schemas.common import ProcessingStatus, SourceType

# Caps on POST /v1/sources so a JWT holder cannot POST multi-MB bodies that
# hit Storage and the Haiku pipeline. raw_html is storage-only; content is
# what map-reduce actually processes. Reject, do not truncate (truncation
# would change the content hash).
MAX_CAPTURE_CONTENT_CHARS = 500_000
MAX_CAPTURE_RAW_HTML_CHARS = 2_000_000


class CaptureRequest(BaseModel):
    """Payload the extension background worker POSTs to ``/v1/sources``.

    ``content`` carries small text payloads (a YouTube transcript JSON string,
    an AI-chat thread JSON string, or an article's cleaned text). ``raw_html``
    is an optional companion for articles so the server can persist both
    ``raw/page.html`` and ``raw/extracted.txt`` (design §2.4 capture table).
    Large binary sources (PDF) do not use this endpoint — see
    ``/v1/sources/upload-url``.
    """

    space_id: UUID
    type: SourceType
    url: HttpUrl | None = None
    title: str = Field(min_length=1, max_length=500)
    author: str | None = Field(default=None, max_length=500)
    content: str | None = Field(default=None, max_length=MAX_CAPTURE_CONTENT_CHARS)
    raw_html: str | None = Field(default=None, max_length=MAX_CAPTURE_RAW_HTML_CHARS)
    anchor: dict | None = None
    # Optional client-computed hash; the server always recomputes the
    # authoritative value and only uses this to detect drift.
    content_hash: str | None = Field(default=None, max_length=64)


class CaptureResponse(BaseModel):
    source_id: UUID
    processing_status: ProcessingStatus


class UploadUrlRequest(BaseModel):
    """Request a pre-signed upload for a large binary source (PDF)."""

    space_id: UUID
    title: str = Field(min_length=1, max_length=500)
    url: HttpUrl | None = None
    author: str | None = Field(default=None, max_length=500)
    content_hash: str | None = Field(default=None, max_length=64)


class UploadUrlResponse(BaseModel):
    """A tokenized Supabase upload URL the client PUTs the file to.

    Note: this is NOT an S3 pre-signed PUT. The client PUTs the bytes to
    ``upload_url`` with header ``x-upsert: true``; ``token`` authorizes it.
    Single-use, short-lived.
    """

    source_id: UUID
    processing_status: ProcessingStatus
    upload_url: str
    token: str
    path: str

class StructuredSummary(BaseModel):
    """The 4-part per-source summary, as a structured-output envelope."""

    tldr: list[str] = Field(min_length=5, max_length=5)
    key_concepts: list[str] = Field(min_length=1, max_length=8)
    examples: list[str] = Field(min_length=1, max_length=6)
    interview_points: list[str] = Field(min_length=1, max_length=6)


class SummaryResponse(BaseModel):
    summary: str
    sections: StructuredSummary
    generated: bool          # True if generated this call, False if cached
    model: str | None
    summarized_at: datetime | None

class ChatMessage(BaseModel):
    id: UUID
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime

class MessageListResponse(BaseModel):
    messages: list[ChatMessage]

class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=8000)

class SendMessageResponse(BaseModel):
    user_message: ChatMessage
    assistant_message: ChatMessage
