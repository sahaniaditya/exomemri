"""Study plan: overdue reviews and uncovered coverage topics, resequenced.

V2 scope, deliberately simple: no new gap-detection, no new LLM call, and
nothing new to persist — this composes what ``ReviewService`` and
``CoverageService`` already compute. Overdue reviews are sequenced first
(bounded prior effort, quick wins), then uncovered topics. There is no
calendar/pacing dimension — ``goal_text`` carries no target date, so this is
an ordered list, not a schedule.
"""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from app.schemas.common import User
from app.schemas.plan import (
    MAX_OVERDUE_REVIEW_ITEMS,
    MAX_UNCOVERED_TOPICS,
    PlanItem,
    StudyPlanResponse,
)
from app.services.coverage_service import CoverageService
from app.services.review_service import ReviewService
from app.services.space_service import SpaceService


class PlanService:
    def __init__(
        self, coverage: CoverageService, reviews: ReviewService, spaces: SpaceService
    ) -> None:
        self._coverage = coverage
        self._reviews = reviews
        self._spaces = spaces

    async def get_plan(self, user: User, space_id: UUID) -> StudyPlanResponse:
        self._spaces.require_owned_space(user, space_id)

        queue = self._reviews.get_today_queue(user, space_id)
        coverage = await self._coverage.get_coverage(user, space_id)

        items = [
            PlanItem(
                kind="overdue_review",
                title=review_item.prompt_text,
                rationale=f"Overdue — from \"{review_item.source_title}\"",
                review_item_id=review_item.id,
            )
            for review_item in queue.items[:MAX_OVERDUE_REVIEW_ITEMS]
        ]
        items.extend(
            PlanItem(
                kind="uncovered_topic",
                title=topic.label,
                rationale="Not yet covered by anything you've captured",
            )
            for topic in coverage.topics
            if not topic.covered
        )
        # Cap the uncovered-topic tail; overdue reviews are never trimmed by
        # this second cap since they're already bounded above.
        items = items[: MAX_OVERDUE_REVIEW_ITEMS + MAX_UNCOVERED_TOPICS]

        return StudyPlanResponse(
            space_id=space_id, items=items, generated_at=datetime.now(UTC)
        )
