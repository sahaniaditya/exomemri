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


MAX_TOPICS_PER_SOURCE = 24
MAX_SUBTOPICS_PER_TOPIC = 8
MAX_TOPIC_NAME_LENGTH = 160
MAX_TOPIC_DESCRIPTION_LENGTH = 8000
MAX_SUBTOPIC_DESCRIPTION_LENGTH = 4000
# Any real article/note above this length must split into several topics rather
# than one card named after the source title. 2500 was too high: short blogs
# and abstracts never hit the detailed parse envelope.
DETAILED_SUMMARY_MIN_TOPICS = 4
DETAILED_SUMMARY_EXTRACT_CHARS = 400


class SubtopicDescription(BaseModel):
    """A named subtopic covered inside a major topic."""

    name: str = Field(
        min_length=2,
        max_length=MAX_TOPIC_NAME_LENGTH,
        description="Short specific noun phrase for the subtopic.",
    )
    description: str = Field(
        min_length=1,
        max_length=MAX_SUBTOPIC_DESCRIPTION_LENGTH,
        description=(
            "Summarized description of this subtopic: definition, how it works, "
            "key facts, numbers, and caveats. Not a headline."
        ),
    )


class TopicDescription(BaseModel):
    """One major topic the source teaches, with a summarized description and subtopics."""

    name: str = Field(
        min_length=2,
        max_length=MAX_TOPIC_NAME_LENGTH,
        description="Short specific noun phrase copied from the source. Never invent a name.",
    )
    description: str = Field(
        min_length=1,
        max_length=MAX_TOPIC_DESCRIPTION_LENGTH,
        description=(
            "Summarized description of what the source taught about this topic: "
            "definitions, how it works, key facts, steps, numbers, names, and caveats. "
            "Not a headline or a one-sentence summary."
        ),
    )
    subtopics: list[SubtopicDescription] = Field(
        default_factory=list,
        max_length=MAX_SUBTOPICS_PER_TOPIC,
        description="Named subtopics covered inside this topic.",
    )


class TopicDescriptionOutput(TopicDescription):
    """LLM parse envelope: a real writeup, not a one-liner."""

    description: str = Field(
        min_length=200,
        max_length=MAX_TOPIC_DESCRIPTION_LENGTH,
        description=(
            "Summarized description of what the source taught about this topic: "
            "definitions, how it works, key facts, steps, numbers, names, and caveats. "
            "Not a headline or a one-sentence summary."
        ),
    )


class StructuredSummary(BaseModel):
    """Per-source LLM output: topics with descriptions, plus supporting sections.

    ``topics`` is empty on rows summarized before this shape existed.
    """

    topics: list[TopicDescription] = Field(default_factory=list, max_length=MAX_TOPICS_PER_SOURCE)
    tldr: list[str] = Field(min_length=5, max_length=10)
    key_concepts: list[str] = Field(min_length=1, max_length=10)
    examples: list[str] = Field(min_length=1, max_length=8)

    def as_prose(self) -> str:
        """Flat text for chat context and ``summary_text`` storage."""
        if not self.topics:
            return "\n".join(self.tldr)
        blocks: list[str] = []
        for topic in self.topics:
            blocks.append(f"{topic.name} — {topic.description}")
            for sub in topic.subtopics:
                blocks.append(f"{topic.name} / {sub.name} — {sub.description}")
        return "\n\n".join(blocks)


class StructuredSummaryOutput(StructuredSummary):
    """LLM parse envelope: at least one topic so the model cannot omit descriptions."""

    topics: list[TopicDescription] = Field(min_length=1, max_length=MAX_TOPICS_PER_SOURCE)


class DetailedStructuredSummaryOutput(StructuredSummary):
    """LLM parse envelope for long sources: several topics, not one title card."""

    topics: list[TopicDescriptionOutput] = Field(
        min_length=DETAILED_SUMMARY_MIN_TOPICS,
        max_length=MAX_TOPICS_PER_SOURCE,
    )


class SummaryResponse(BaseModel):
    summary: str | None = None
    sections: StructuredSummary | None = None
    generated: bool          # True if generated this call, False if cached
    model: str | None = None
    summarized_at: datetime | None = None

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
