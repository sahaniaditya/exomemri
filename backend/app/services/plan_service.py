"""Study plan: uncovered coverage topics, sequenced as the next-to-study list.

V2 scope, deliberately simple: no new gap-detection, no LLM call, and nothing
new to persist — this composes what ``CoverageService`` already computes.
There is no calendar/pacing dimension — ``goal_text`` carries no target date,
so this is an ordered list, not a schedule.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from app.schemas.common import User
from app.schemas.plan import MAX_UNCOVERED_TOPICS, PlanItem, StudyPlanResponse
from app.services.coverage_service import CoverageService
from app.services.space_service import SpaceService


class PlanService:
    def __init__(self, coverage: CoverageService, spaces: SpaceService) -> None:
        self._coverage = coverage
        self._spaces = spaces

    async def get_plan(self, user: User, space_id: UUID) -> StudyPlanResponse:
        self._spaces.require_owned_space(user, space_id)
        coverage = await self._coverage.get_coverage(user, space_id)

        items = [
            PlanItem(
                kind="uncovered_topic",
                title=topic.label,
                rationale="Not yet covered by anything you've captured",
            )
            for topic in coverage.topics
            if not topic.covered
        ][:MAX_UNCOVERED_TOPICS]

        return StudyPlanResponse(
            space_id=space_id, items=items, generated_at=datetime.now(UTC)
        )
