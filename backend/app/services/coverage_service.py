"""Coverage %: an LLM-inferred syllabus diffed against captured concepts.

Lazily generated and cached on ``space_coverage``, the same "generate on first
read, cache thereafter" shape as ``SourceChatService.get_or_create_summary``.
The cache invalidates when the space's concept count changes — a cheap
staleness signal that avoids re-running the LLM on every read while still
picking up new captures.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from functools import partial
from uuid import UUID

import anyio

from app.config import Settings
from app.repositories.concept_repo import ConceptRepo
from app.repositories.coverage_repo import CoverageRepo
from app.schemas.common import User
from app.schemas.coverage import CoverageResponse, SyllabusTopic
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
    ) -> None:
        self._coverage = coverage
        self._concepts = concepts
        self._spaces = spaces
        self._llm = llm
        self._limiter = limiter
        self._settings = settings

    async def get_coverage(self, user: User, space_id: UUID) -> CoverageResponse:
        space = self._spaces.require_owned_space(user, space_id)
        concept_labels = await anyio.to_thread.run_sync(
            partial(self._concepts.list_labels, space_id=str(space_id))
        )

        cached = await anyio.to_thread.run_sync(
            partial(self._coverage.get, space_id=str(space_id))
        )
        if cached and cached.get("syllabus_concept_count") == len(concept_labels):
            return self._to_response(space_id, cached)

        if not concept_labels:
            # Nothing mapped yet — there's no basis to infer a syllabus from,
            # so this reports "not assessed" rather than 0%.
            return CoverageResponse(
                space_id=space_id, coverage_pct=None, topics=[], generated_at=None
            )

        # Throttle LLM regen only — cache hits above stay unlimited.
        self._limiter.check(
            f"coverage:space:{space_id}",
            limit=self._settings.rate_limit_coverage_max,
            window_seconds=self._settings.rate_limit_coverage_window_seconds,
        )

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
    def _to_response(space_id: UUID, row: dict) -> CoverageResponse:
        return CoverageResponse(
            space_id=space_id,
            coverage_pct=row.get("coverage_pct"),
            topics=[SyllabusTopic(**t) for t in (row.get("syllabus_topics") or [])],
            generated_at=row.get("generated_at"),
        )
