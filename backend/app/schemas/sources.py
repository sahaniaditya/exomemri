"""Source capture endpoint contracts.

These Pydantic models are the single source of truth for the OpenAPI schema,
which is in turn the source of truth for the extension's generated TS types
(``extension/src/lib/types.ts``). Do not hand-edit the generated types.
"""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl

from app.schemas.common import ProcessingStatus, SourceType


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
    content: str | None = None
    raw_html: str | None = None
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
