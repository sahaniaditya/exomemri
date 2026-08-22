"""Daily review queue: builds and serves the "study today" list.

V2 scope, deliberately simple: an item is due if it's never been reviewed or
was last reviewed more than ``STALENESS_DAYS`` ago. No spaced-repetition
algorithm — the only user signal is a binary "mark reviewed" action, so there
is nothing yet for an adaptive scheduler to adapt on.
"""

from __future__ import annotations

import logging
from functools import partial
from uuid import UUID

import anyio

from app.errors import NotFoundError
from app.repositories.review_repo import ReviewRepo
from app.schemas.common import User
from app.schemas.review import (
    DAILY_QUEUE_LIMIT,
    STALENESS_DAYS,
    ReviewItem,
    ReviewQueueResponse,
    ReviewRebuildResponse,
)
from app.schemas.sources import StructuredSummary
from app.services.space_service import SpaceService
from app.services.streak_service import StreakService

logger = logging.getLogger(__name__)

# How many sources one backfill request will generate items for. Bounded so
# the request finishes inside Render's timeout; the client loops until
# `pending` reaches 0.
BACKFILL_BATCH_SIZE = 8


class ReviewService:
    def __init__(
        self, reviews: ReviewRepo, spaces: SpaceService, streaks: StreakService
    ) -> None:
        self._reviews = reviews
        self._spaces = spaces
        self._streaks = streaks

    # --- reads ---

    def get_today_queue(self, user: User, space_id: UUID) -> ReviewQueueResponse:
        self._spaces.require_owned_space(user, space_id)
        rows = self._reviews.list_due(
            space_id=str(space_id),
            user_id=str(user.id),
            staleness_days=STALENESS_DAYS,
            limit=DAILY_QUEUE_LIMIT,
        )
        total_due = self._reviews.count_due(
            space_id=str(space_id), user_id=str(user.id), staleness_days=STALENESS_DAYS
        )
        items = [self._to_review_item(row) for row in rows]
        return ReviewQueueResponse(
            items=items, total_pending=max(0, total_due - len(items))
        )

    def mark_reviewed(self, user: User, space_id: UUID, item_id: UUID) -> ReviewItem:
        self._spaces.require_owned_space(user, space_id)
        row = self._reviews.mark_reviewed(
            item_id=str(item_id), space_id=str(space_id), user_id=str(user.id)
        )
        if not row:
            raise NotFoundError("Review item not found.", detail={"item_id": str(item_id)})
        self._streaks.record_activity(str(user.id))
        return self._to_review_item(row)

    # --- generation ---

    async def generate_for_source(self, *, source: dict, sections: StructuredSummary) -> int:
        """One review item per interview point in this source's summary.

        Called from the pipeline right after the structured summary is
        produced, and from ``backfill`` for sources captured before this
        feature shipped.
        """
        await anyio.to_thread.run_sync(
            partial(
                self._reviews.replace_source_items,
                source_id=source["id"],
                space_id=source["space_id"],
                user_id=source["user_id"],
                prompts=sections.interview_points,
            )
        )
        await anyio.to_thread.run_sync(
            partial(self._spaces.mark_review_items_extracted, source_id=UUID(source["id"]))
        )
        return len(sections.interview_points)

    async def backfill(self, *, user: User, space_id: UUID) -> ReviewRebuildResponse:
        """Generate review items for one bounded batch of unprocessed sources.

        Sources captured before this feature existed, or whose pipeline run
        failed before reaching the summary stage, have none — this is the
        only way those ever join the queue.
        """
        self._spaces.require_owned_space(user, space_id)
        sources = await anyio.to_thread.run_sync(
            partial(
                self._spaces.list_unreviewed_sources,
                space_id=space_id,
                limit=BACKFILL_BATCH_SIZE,
            )
        )

        processed = 0
        failed = 0
        for source in sources:
            try:
                sections_dict = source.get("summary_sections")
                if not sections_dict:
                    # Not summarized yet — nothing to generate from. Leave it
                    # unmarked so a later backfill call (after the pipeline
                    # catches up) picks it up.
                    continue
                sections = StructuredSummary(**sections_dict)
                await self.generate_for_source(source=source, sections=sections)
                processed += 1
            except Exception:  # noqa: BLE001 - one bad source must not fail the batch
                logger.warning(
                    "review_backfill_source_failed", extra={"source_id": source["id"]}
                )
                await anyio.to_thread.run_sync(
                    partial(
                        self._spaces.mark_review_items_extracted,
                        source_id=UUID(source["id"]),
                    )
                )
                failed += 1

        remaining = await anyio.to_thread.run_sync(
            partial(self._spaces.list_unreviewed_sources, space_id=space_id, limit=1000)
        )
        return ReviewRebuildResponse(processed=processed, failed=failed, pending=len(remaining))

    def _to_review_item(self, row: dict) -> ReviewItem:
        source = row.get("sources") or {}
        return ReviewItem(
            id=row["id"],
            source_id=row["source_id"],
            source_title=source.get("title", ""),
            space_id=row["space_id"],
            prompt_text=row["prompt_text"],
            last_reviewed_at=row.get("last_reviewed_at"),
        )
