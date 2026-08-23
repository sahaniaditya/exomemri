"""Concept extraction and knowledge-map reads.

The single implementation of "turn a source's text into canonical concepts",
called from two places: the ``extract_concepts`` node of the capture pipeline
(new captures, automatically) and ``POST /v1/spaces/{id}/graph/rebuild``
(backfill for sources captured before this feature shipped). Keeping both on one
method is what stops the canonicalization rules drifting between them.
"""

from __future__ import annotations

import logging
from functools import partial
from uuid import UUID

import anyio

from app.repositories.concept_repo import ConceptRepo
from app.schemas.common import User
from app.schemas.concepts import (
    ConceptNode,
    GraphEdge,
    RebuildResponse,
    SourceNode,
    SpaceGraphResponse,
)
from app.services.extract_service import ExtractService
from app.services.llm_service import LLMService
from app.services.space_service import SpaceService, slugify

logger = logging.getLogger(__name__)

# How many sources one backfill request will extract. Bounded so the request
# finishes inside Render's timeout regardless of how far behind a space is; the
# client loops until `pending` reaches 0.
BACKFILL_BATCH_SIZE = 8


class ConceptService:
    def __init__(
        self,
        concepts: ConceptRepo,
        spaces: SpaceService,
        extracts: ExtractService,
        llm: LLMService,
    ) -> None:
        self._concepts = concepts
        self._spaces = spaces
        self._extracts = extracts
        self._llm = llm

    # --- reads ---

    def get_graph(self, user: User, space_id: UUID) -> SpaceGraphResponse:
        space = self._spaces.require_owned_space(user, space_id)
        row = self._concepts.get_space_graph(user_id=space["user_id"], space_id=str(space_id))
        return SpaceGraphResponse(
            concepts=[ConceptNode(**c) for c in row["concepts"]],
            sources=[SourceNode(**s) for s in row["sources"]],
            edges=[GraphEdge(**e) for e in row["edges"]],
            pending=row["pending"],
        )

    # --- extraction ---

    async def extract_for_source(self, *, source: dict, extract: str) -> int:
        """Map one source onto its space's concepts. Returns the edge count.

        ``extract`` is passed in rather than read here so the pipeline can reuse
        the text it already fetched instead of hitting Storage a second time.
        """
        space_id = source["space_id"]
        user_id = source["user_id"]
        source_id = source["id"]

        vocabulary = await anyio.to_thread.run_sync(
            partial(self._concepts.list_labels, space_id=space_id)
        )
        extracted = await self._llm.extract_concepts(
            title=source["title"], extract=extract, vocabulary=vocabulary
        )

        # Collapse to one row per slug before hitting the database: the model can
        # return "Load balancing" and "Load balancers" in the same response, and
        # upserting both in one statement would fail on the unique index rather
        # than merge. Keep the highest weight when that happens.
        by_slug: dict[str, dict] = {}
        for item in extracted:
            label = item.label.strip()
            slug = slugify(label)
            if not slug or slug == "space":
                # slugify() falls back to "space" for input with no usable
                # characters (all emoji/CJK) — not a real concept.
                continue
            existing = by_slug.get(slug)
            if existing is None or item.weight > existing["weight"]:
                by_slug[slug] = {"label": label, "slug": slug, "weight": item.weight}

        if not by_slug:
            await self._mark_done(source_id)
            return 0

        rows = await anyio.to_thread.run_sync(
            partial(
                self._concepts.upsert_concepts,
                [
                    {
                        "space_id": space_id,
                        "user_id": user_id,
                        "label": c["label"],
                        "slug": c["slug"],
                    }
                    for c in by_slug.values()
                ],
            )
        )
        # The upsert returns existing rows for slugs already in the space, so this
        # maps every extracted concept to its canonical id whether new or merged.
        id_by_slug = {row["slug"]: row["id"] for row in rows}

        edges = [
            {
                "source_id": source_id,
                "concept_id": id_by_slug[slug],
                "space_id": space_id,
                "user_id": user_id,
                "weight": concept["weight"],
            }
            for slug, concept in by_slug.items()
            if slug in id_by_slug
        ]
        await anyio.to_thread.run_sync(
            partial(self._concepts.replace_source_concepts, source_id=source_id, edges=edges)
        )
        await anyio.to_thread.run_sync(
            partial(self._concepts.delete_orphan_concepts, space_id=space_id)
        )
        await self._mark_done(source_id)
        return len(edges)

    async def backfill(self, *, user: User, space_id: UUID) -> RebuildResponse:
        """Extract one bounded batch of not-yet-mapped sources in a space.

        Sources captured before this feature existed have no concepts, and a
        source whose pipeline run failed has none either. This is the only way
        those ever join the map.
        """
        self._spaces.require_owned_space(user, space_id)
        sources = await anyio.to_thread.run_sync(
            partial(
                self._spaces.list_unextracted_sources,
                space_id=space_id,
                limit=BACKFILL_BATCH_SIZE,
            )
        )

        processed = 0
        failed = 0
        for source in sources:
            try:
                extract = await self._extracts.read_full_extract(source)
                await self.extract_for_source(source=source, extract=extract)
                processed += 1
            except Exception:  # noqa: BLE001 - one bad source must not fail the batch
                # A PDF with no text-extraction artifact is the common case here.
                # Mark it done so the backfill loop can terminate instead of
                # retrying the same unfixable source forever.
                logger.warning("concept_backfill_source_failed", extra={"source_id": source["id"]})
                await self._mark_done(source["id"])
                failed += 1

        remaining = await anyio.to_thread.run_sync(
            partial(self._spaces.list_unextracted_sources, space_id=space_id, limit=1000)
        )
        return RebuildResponse(processed=processed, failed=failed, pending=len(remaining))

    def prune_source(self, *, source_id: UUID, space_id: UUID) -> None:
        """Drop this source's concept edges and any concepts nobody mentions.

        Safe after the source row is already gone: ``source_concepts`` cascade
        on the real database, and the explicit delete keeps the in-memory fake
        in the same shape.
        """
        self._concepts.replace_source_concepts(source_id=str(source_id), edges=[])
        self._concepts.delete_orphan_concepts(space_id=str(space_id))

    async def _mark_done(self, source_id: str) -> None:
        await anyio.to_thread.run_sync(
            partial(
                self._spaces.mark_concepts_extracted,
                source_id=UUID(source_id),
                model=self._llm.model_name,
            )
        )
