"""Coverage-per-space contracts.

Like the other schema modules, these Pydantic models are the source of truth for
the OpenAPI schema, which generates the extension's TS types
(``extension/src/lib/types.ts`` — never hand-edited).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# Bounds on the LLM-inferred syllabus so a pathological response can't produce
# an unusably long (or trivially short) topic list.
MIN_SYLLABUS_TOPICS = 4
MAX_SYLLABUS_TOPICS = 16


class SyllabusTopic(BaseModel):
    """One inferred syllabus topic and whether captured concepts cover it."""

    label: str = Field(min_length=2, max_length=120)
    covered: bool


class SyllabusTopics(BaseModel):
    """The structured-output envelope handed to ``messages.parse``."""

    topics: list[SyllabusTopic] = Field(
        min_length=MIN_SYLLABUS_TOPICS, max_length=MAX_SYLLABUS_TOPICS
    )


class CoverageResponse(BaseModel):
    space_id: UUID
    # None until a space has at least one mapped concept to infer a syllabus
    # from — an empty space hasn't been "assessed," so this is not 0.
    coverage_pct: int | None
    topics: list[SyllabusTopic]
    generated_at: datetime | None
