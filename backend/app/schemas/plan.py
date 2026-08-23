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

PlanItemKind = Literal["uncovered_topic"]

# Cap on uncovered topics in the plan. V2 scope: a resequencing of
# already-computed gaps, not a new generator.
MAX_UNCOVERED_TOPICS = 5


class PlanItem(BaseModel):
    kind: PlanItemKind
    title: str
    rationale: str


class StudyPlanResponse(BaseModel):
    space_id: UUID
    items: list[PlanItem]
    # When this composition ran — there is nothing cached to be stale, so this
    # is just "now," not a generation timestamp like coverage's.
    generated_at: datetime
