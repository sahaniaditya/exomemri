"""Coverage %: an LLM-inferred syllabus diffed against captured concepts.

GET is cache-only. Generation happens on explicit POST (1 credit) or as a
free, rate-limited refresh after the capture pipeline extracts concepts.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from functools import partial
from uuid import UUID

import anyio

from app.config import Settings
from app.errors import RateLimitError
from app.repositories.concept_repo import ConceptRepo
from app.repositories.coverage_repo import CoverageRepo
from app.schemas.common import User
from app.schemas.coverage import CoverageResponse, SyllabusTopic
from app.services.credits_service import CreditsService
from app.services.llm_service import LLMService
from app.services.rate_limit_service import RateLimitService
from app.services.space_service import SpaceService

logger = logging.getLogger(__name__)


class CoverageService:
    def __init__(
        self,
        coverage: CoverageRepo,
        concepts: ConceptRepo,
        spaces: SpaceService,
        llm: LLMService,
        limiter: RateLimitService,
        settings: Settings,
        credits: CreditsService,
    ) -> None:
        self._coverage = coverage
        self._concepts = concepts
        self._spaces = spaces
        self._llm = llm
        self._limiter = limiter
        self._settings = settings
        self._credits = credits

    async def get_coverage(self, user: User, space_id: UUID) -> CoverageResponse:
        """Read the cached syllabus. Never calls the LLM or consumes credits."""
        self._spaces.require_owned_space(user, space_id)
        cached = await anyio.to_thread.run_sync(
            partial(self._coverage.get, space_id=str(space_id))
        )
        if cached:
            return self._to_response(space_id, cached)
        return self._empty(space_id)

    async def regenerate(self, user: User, space_id: UUID) -> CoverageResponse:
        """Owner-triggered syllabus regen: rate-limited, 1 credit, refund on fail."""
        space = self._spaces.require_owned_space(user, space_id)
        concept_labels = await anyio.to_thread.run_sync(
            partial(self._concepts.list_labels, space_id=str(space_id))
        )
        if not concept_labels:
            return self._empty(space_id)

        self._check_rate_limit(space_id)
        await anyio.to_thread.run_sync(
            partial(self._credits.consume, str(user.id), reason="coverage")
        )
        try:
            return await self._write_syllabus(
                user=user,
                space_id=space_id,
                space=space,
                concept_labels=concept_labels,
            )
        except Exception:
            await anyio.to_thread.run_sync(partial(self._credits.refund, str(user.id)))
            raise

    async def maybe_refresh(self, user: User, space_id: UUID) -> None:
        """Pipeline/rebuild hook: refresh if stale, skip if fresh or rate-limited.

        Never consumes a credit (capture/rebuild already paid) and never raises
        for rate limits or LLM failure — a coverage miss must not fail a source.
        """
        space = self._spaces.require_owned_space(user, space_id)
        concept_labels = await anyio.to_thread.run_sync(
            partial(self._concepts.list_labels, space_id=str(space_id))
        )
        if not concept_labels:
            return

        cached = await anyio.to_thread.run_sync(
            partial(self._coverage.get, space_id=str(space_id))
        )
        if cached and cached.get("syllabus_concept_count") == len(concept_labels):
            return

        try:
            self._check_rate_limit(space_id)
        except RateLimitError:
            return

        try:
            await self._write_syllabus(
                user=user,
                space_id=space_id,
                space=space,
                concept_labels=concept_labels,
            )
        except Exception:  # noqa: BLE001 - coverage must not fail the caller
            logger.warning("coverage_refresh_failed", extra={"space_id": str(space_id)})

    def _check_rate_limit(self, space_id: UUID) -> None:
        self._limiter.check(
            f"coverage:space:{space_id}",
            limit=self._settings.rate_limit_coverage_max,
            window_seconds=self._settings.rate_limit_coverage_window_seconds,
        )

    async def _write_syllabus(
        self,
        *,
        user: User,
        space_id: UUID,
        space: dict,
        concept_labels: list[str],
    ) -> CoverageResponse:
        topics = await self._llm.infer_syllabus_coverage(
            space_name=space["name"],
            goal_text=space.get("goal_text"),
            concept_labels=concept_labels,
        )
        coverage_pct = self._pct_covered(topics)
        generated_at = datetime.now(UTC)
        await anyio.to_thread.run_sync(
            partial(
                self._coverage.upsert,
                space_id=str(space_id),
                user_id=str(user.id),
                coverage_pct=coverage_pct,
                topics=[t.model_dump() for t in topics],
                concept_count=len(concept_labels),
                generated_at=generated_at.isoformat(),
            )
        )
        return CoverageResponse(
            space_id=space_id, coverage_pct=coverage_pct, topics=topics, generated_at=generated_at
        )

    @staticmethod
    def _pct_covered(topics: list[SyllabusTopic]) -> int:
        if not topics:
            return 0
        covered = sum(1 for t in topics if t.covered)
        return round(covered / len(topics) * 100)

    @staticmethod
    def _empty(space_id: UUID) -> CoverageResponse:
        return CoverageResponse(
            space_id=space_id, coverage_pct=None, topics=[], generated_at=None
        )

    @staticmethod
    def _to_response(space_id: UUID, row: dict) -> CoverageResponse:
        return CoverageResponse(
            space_id=space_id,
            coverage_pct=row.get("coverage_pct"),
            topics=[SyllabusTopic(**t) for t in (row.get("syllabus_topics") or [])],
            generated_at=row.get("generated_at"),
        )
