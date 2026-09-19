"""Source capture endpoint contracts.

These Pydantic models are the single source of truth for the OpenAPI schema,
which is in turn the source of truth for the extension's generated TS types
(``extension/src/lib/types.ts``). Do not hand-edit the generated types.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, HttpUrl, field_validator

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


# --- Summary shape caps -----------------------------------------------------
# These are now *ceilings only* (used to truncate an overshooting LLM list),
# not floors the LLM must clear. Availability > strictness: a thin summary
# that parses beats a rejected response that doesn't. If you need to bring
# quality checks back, do it as a post-hoc quality score / re-prompt, not as
# a validation error that kills the whole call.
MAX_TOPICS_PER_SOURCE = 24
MAX_SUBTOPICS_PER_TOPIC = 8
MAX_TOPIC_NAME_LENGTH = 160
MAX_TOPIC_DESCRIPTION_LENGTH = 8000
MAX_SUBTOPIC_DESCRIPTION_LENGTH = 4000
MAX_KEY_CONCEPTS = 10
MAX_TLDR = 10
MAX_EXAMPLES = 8

DETAILED_SUMMARY_EXTRACT_CHARS = 400


def _truncate_list(v: Any, max_len: int) -> Any:
    """Keep the model's own ordering (assumed importance-first) and drop the tail
    instead of failing validation when the LLM overshoots a cap."""
    if isinstance(v, list) and len(v) > max_len:
        return v[:max_len]
    return v


def _coerce_str(v: Any) -> Any:
    """Best-effort coercion so a None/number/etc from a flaky LLM parse
    doesn't hard-fail validation; empty/missing becomes an empty string
    rather than raising."""
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    return str(v)


class SubtopicDescription(BaseModel):
    """A named subtopic covered inside a major topic."""
    name: str = Field(
        default="",
        max_length=MAX_TOPIC_NAME_LENGTH,
        description="Short specific noun phrase for the subtopic.",
    )
    description: str = Field(
        default="",
        max_length=MAX_SUBTOPIC_DESCRIPTION_LENGTH,
        description=(
            "Summarized description of this subtopic: definition, how it works, "
            "key facts, numbers, and caveats. Not a headline."
        ),
    )

    @field_validator("name", "description", mode="before")
    @classmethod
    def _coerce(cls, v: Any) -> Any:
        return _coerce_str(v)


class TopicDescription(BaseModel):
    """One major topic the source teaches, with a summarized description and subtopics."""
    name: str = Field(
        default="",
        max_length=MAX_TOPIC_NAME_LENGTH,
        description="Short specific noun phrase copied from the source. Never invent a name.",
    )
    description: str = Field(
        default="",
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

    @field_validator("name", "description", mode="before")
    @classmethod
    def _coerce(cls, v: Any) -> Any:
        return _coerce_str(v)

    @field_validator("subtopics", mode="before")
    @classmethod
    def _cap_subtopics(cls, v: Any) -> Any:
        return _truncate_list(v, MAX_SUBTOPICS_PER_TOPIC)


class TopicDescriptionOutput(TopicDescription):
    """LLM parse envelope. Previously required a 200+ char writeup; that floor
    is gone now — a short-but-present description is accepted so a slightly
    thin topic doesn't sink the whole summary."""
    description: str = Field(
        default="",
        max_length=MAX_TOPIC_DESCRIPTION_LENGTH,
        description=(
            "Summarized description of what the source taught about this topic: "
            "definitions, how it works, key facts, steps, numbers, names, and caveats. "
            "Not a headline or a one-sentence summary."
        ),
    )


class StructuredSummary(BaseModel):
    """Per-source LLM output: topics with descriptions, plus supporting sections.

    ``topics`` is empty on rows summarized before this shape existed, and may
    also be empty if the LLM output didn't include any — callers should treat
    an empty ``topics`` list as "fall back to ``tldr``" (see ``as_prose``).
    """
    topics: list[TopicDescription] = Field(default_factory=list, max_length=MAX_TOPICS_PER_SOURCE)
    tldr: list[str] = Field(default_factory=list, max_length=MAX_TLDR)
    key_concepts: list[str] = Field(default_factory=list, max_length=MAX_KEY_CONCEPTS)
    examples: list[str] = Field(default_factory=list, max_length=MAX_EXAMPLES)

    @field_validator("topics", mode="before")
    @classmethod
    def _cap_topics(cls, v: Any) -> Any:
        return _truncate_list(v, MAX_TOPICS_PER_SOURCE)

    @field_validator("key_concepts", mode="before")
    @classmethod
    def _cap_key_concepts(cls, v: Any) -> Any:
        return _truncate_list(v, MAX_KEY_CONCEPTS)

    @field_validator("tldr", mode="before")
    @classmethod
    def _cap_tldr(cls, v: Any) -> Any:
        return _truncate_list(v, MAX_TLDR)

    @field_validator("examples", mode="before")
    @classmethod
    def _cap_examples(cls, v: Any) -> Any:
        return _truncate_list(v, MAX_EXAMPLES)

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
    """LLM parse envelope. No longer requires at least one topic — an LLM
    response with only tldr/key_concepts/examples now parses fine and
    ``as_prose()`` falls back to the tldr."""
    topics: list[TopicDescription] = Field(default_factory=list, max_length=MAX_TOPICS_PER_SOURCE)


class DetailedStructuredSummaryOutput(StructuredSummary):
    """LLM parse envelope for long sources. No longer requires 4+ topics —
    fewer topics now parses instead of raising."""
    topics: list[TopicDescriptionOutput] = Field(
        default_factory=list,
        max_length=MAX_TOPICS_PER_SOURCE,
    )

    @field_validator("topics", mode="before")
    @classmethod
    def _cap_topics_detailed(cls, v: Any) -> Any:
        return _truncate_list(v, MAX_TOPICS_PER_SOURCE)


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