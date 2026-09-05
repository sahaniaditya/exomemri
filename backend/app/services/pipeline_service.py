"""Entry point the capture router fires as a background task.

Wraps the compiled LangGraph pipeline so a failure anywhere in it (including
a bug in the graph itself, not just a node's own try/except) can never
propagate out of a ``BackgroundTasks`` callable — such an exception would
otherwise only be logged to stderr and be invisible to the caller.
"""

from __future__ import annotations

import logging
from functools import partial
from uuid import UUID

import anyio

from app.repositories.chunk_repo import ChunkRepo
from app.schemas.common import User
from app.services.concept_service import ConceptService
from app.services.coverage_service import CoverageService
from app.services.embedding_service import EmbeddingService
from app.services.extract_service import ExtractService
from app.services.llm_service import LLMService
from app.services.pipeline.graph import build_pipeline
from app.services.space_service import SpaceService

logger = logging.getLogger(__name__)


class PipelineService:
    def __init__(
        self,
        concepts: ConceptService,
        extracts: ExtractService,
        embeddings: EmbeddingService,
        llm: LLMService,
        chunks: ChunkRepo,
        space_service: SpaceService,
        coverage: CoverageService,
    ) -> None:
        self._space_service = space_service
        self._graph = build_pipeline(
            concepts=concepts,
            extracts=extracts,
            embeddings=embeddings,
            llm=llm,
            chunks=chunks,
            space_service=space_service,
            coverage=coverage,
        )

    async def run(self, *, user: User, source_id: UUID, space_id: UUID) -> None:
        try:
            source = await anyio.to_thread.run_sync(
                partial(self._space_service.require_owned_source, user, source_id)
            )
            await self._graph.ainvoke(
                {
                    "source_id": str(source_id),
                    "space_id": str(space_id),
                    "user_id": str(user.id),
                    "source": source,
                }
            )
        except Exception:  # noqa: BLE001 - a background task must never raise
            logger.error("pipeline_invocation_failed", extra={"source_id": str(source_id)})
            await anyio.to_thread.run_sync(
                partial(
                    self._space_service.update_processing_status,
                    source_id=source_id,
                    status="failed",
                )
            )
