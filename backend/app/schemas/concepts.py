"""Knowledge-map contracts.

Like the other schema modules, these Pydantic models are the source of truth for
the OpenAPI schema, which generates the extension's TS types
(``extension/src/lib/types.ts`` — never hand-edited).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import SourceType

# Caps on what one extraction may produce, enforced on the way out of the LLM so
# a pathological response can't fan out into hundreds of concept rows.
MAX_CONCEPTS_PER_SOURCE = 8
MAX_CONCEPT_LABEL_LENGTH = 80


class ExtractedConcept(BaseModel):
    """One concept as returned by the LLM, before canonicalization."""

    label: str = Field(min_length=2, max_length=MAX_CONCEPT_LABEL_LENGTH)
    weight: float = Field(gt=0, le=1)


class ExtractedConcepts(BaseModel):
    """The structured-output envelope handed to ``messages.parse``."""

    concepts: list[ExtractedConcept] = Field(max_length=MAX_CONCEPTS_PER_SOURCE)


class ConceptNode(BaseModel):
    """A concept in the map. ``degree`` is how many sources reference it."""

    id: UUID
    label: str
    slug: str
    degree: int


class SourceNode(BaseModel):
    """A captured source in the map, trimmed to what the canvas renders."""

    id: UUID
    title: str
    type: SourceType
    captured_at: datetime | None = None


class GraphEdge(BaseModel):
    """A source mentioning a concept, weighted by the LLM's salience score."""

    source_id: UUID
    concept_id: UUID
    weight: float


class SpaceGraphResponse(BaseModel):
    """The whole map for one space, plus how much of it is still unmapped."""

    concepts: list[ConceptNode]
    sources: list[SourceNode]
    edges: list[GraphEdge]
    # Sources with no extraction yet (captured before this feature, or failed).
    pending: int


class RebuildResponse(BaseModel):
    """Outcome of one bounded backfill batch."""

    processed: int
    failed: int
    # Still unmapped after this batch — the client loops until it reaches 0.
    pending: int
