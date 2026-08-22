"""Study-plan contracts.

Like the other schema modules, these Pydantic models are the source of truth for
the OpenAPI schema, which generates the extension's TS types
(``extension/src/lib/types.ts`` — never hand-edited).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel

PlanItemKind = Literal["overdue_review", "uncovered_topic"]

# How many of each kind feed the plan, and the total cap after interleaving.
# V2 scope: a resequencing of already-computed gaps, not a new generator, so
# these are simple caps rather than a pacing/scheduling algorithm.
MAX_OVERDUE_REVIEW_ITEMS = 5
MAX_UNCOVERED_TOPICS = 5


class PlanItem(BaseModel):
    kind: PlanItemKind
    title: str
    rationale: str
    # Set for `overdue_review` items, so the frontend can deep-link into the
    # existing review flow instead of duplicating "mark reviewed" here.
    review_item_id: UUID | None = None


class StudyPlanResponse(BaseModel):
    space_id: UUID
    items: list[PlanItem]
    # When this composition ran — there is nothing cached to be stale, so this
    # is just "now," not a generation timestamp like coverage's.
    generated_at: datetime
