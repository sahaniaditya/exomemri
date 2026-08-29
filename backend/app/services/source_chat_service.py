from __future__ import annotations

import logging
from datetime import UTC, datetime
from functools import partial
from uuid import UUID

import anyio

from app.errors import ConflictError
from app.repositories.chunk_repo import ChunkRepo
from app.schemas.common import ProcessingStatus, User
from app.schemas.sources import (
    ChatMessage,
    MessageListResponse,
    SendMessageResponse,
    StructuredSummary,
    SummaryResponse,
)
from app.services.credits_service import CreditsService
from app.services.embedding_service import EmbeddingService
from app.services.extract_service import ExtractService
from app.services.llm_service import LLMService
from app.services.space_service import SpaceService

# Top-k chunks retrieved per question — enough context without overrunning
# the prompt budget the way the old full-extract approach could.
RETRIEVAL_K = 6

# Pipeline has finished (or given up). Any other processing_status is in-flight
# and GET /summary must not start a parallel Haiku job.
_TERMINAL_STATUSES = frozenset({ProcessingStatus.ready, ProcessingStatus.failed})

logger = logging.getLogger(__name__)

# Per-source locks live at module scope because SourceChatService is constructed
# per request in production DI — an instance dict would not serialize concurrent
# GETs. Pipeline coordination is skip-if-in-flight, not this lock.
_summary_locks: dict[UUID, anyio.Lock] = {}
_summary_locks_guard = anyio.Lock()


async def _lock_for(source_id: UUID) -> anyio.Lock:
    async with _summary_locks_guard:
        lock = _summary_locks.get(source_id)
        if lock is None:
            lock = anyio.Lock()
            _summary_locks[source_id] = lock
        return lock


def _cached_summary(source: dict) -> SummaryResponse | None:
    # Pre-migration rows have summary_text but no summary_sections — treat as a
    # miss so the owner fallback regenerates both via the pipeline bundle.
    if not (source.get("summary_text") and source.get("summary_sections")):
        return None
    return SummaryResponse(
        summary=source["summary_text"],
        sections=StructuredSummary(**source["summary_sections"]),
        generated=False,
        model=source.get("summary_model"),
        summarized_at=source.get("summarized_at"),
    )


def _is_in_flight(source: dict) -> bool:
    return source.get("processing_status") not in _TERMINAL_STATUSES


def _is_source_owner(user: User, source: dict) -> bool:
    return str(source["user_id"]) == str(user.id)


class SourceChatService:
    def __init__(
        self,
        spaces: SpaceService,
        extracts: ExtractService,
        llm: LLMService,
        embeddings: EmbeddingService,
        chunks: ChunkRepo,
        credits: CreditsService,
    ) -> None:
        self._spaces = spaces
        self._extracts = extracts
        self._llm = llm
        self._embeddings = embeddings
        self._chunks = chunks
        self._credits = credits

    async def get_or_create_summary(self, *, user: User, source_id: UUID) -> SummaryResponse:
        # A superset of ownership — lets a read-only collaborator see a
        # source's summary without granting them any write access. Chat
        # (list/send messages) stays strictly owner-only, unaffected.
        source = await anyio.to_thread.run_sync(
            partial(self._spaces.require_viewable_source, user, source_id)
        )
        cached = _cached_summary(source)
        if cached is not None:
            return cached

        # In-flight: the capture pipeline owns generation. Collaborators never
        # trigger Haiku — only the owner may fill a ready/failed cache miss.
        if _is_in_flight(source) or not _is_source_owner(user, source):
            logger.info(
                "summary_generation_skipped",
                extra={
                    "source_id": str(source_id),
                    "in_flight": _is_in_flight(source),
                    "owner": _is_source_owner(user, source),
                },
            )
            raise ConflictError("Summary is still being generated.")

        lock = await _lock_for(source_id)
        async with lock:
            return await self._generate_summary_locked(user=user, source_id=source_id)

    async def _generate_summary_locked(
        self, *, user: User, source_id: UUID
    ) -> SummaryResponse:
        # Re-read under the lock so a concurrent GET that already finished, or a
        # pipeline that advanced status, is not duplicated.
        source = await anyio.to_thread.run_sync(
            partial(self._spaces.require_viewable_source, user, source_id)
        )
        cached = _cached_summary(source)
        if cached is not None:
            return cached
        if _is_in_flight(source) or not _is_source_owner(user, source):
            raise ConflictError("Summary is still being generated.")

        extract = await self._extracts.read_full_extract(source)
        summary, sections = await self._llm.summarize_document_bundle(
            title=source["title"], extract=extract
        )
        await anyio.to_thread.run_sync(
            partial(
                self._spaces.save_summary,
                source_id=source_id,
                summary=summary,
                sections=sections.model_dump(),
                model=self._llm.model_name,
            )
        )
        logger.info("summary_generated", extra={"source_id": str(source_id)})
        return SummaryResponse(
            summary=summary,
            sections=sections,
            generated=True,
            model=self._llm.model_name,
            summarized_at=datetime.now(UTC),
        )

    async def list_messages(self, *, user: User, source_id: UUID) -> MessageListResponse:
        await anyio.to_thread.run_sync(partial(self._spaces.require_owned_source, user, source_id))
        rows = await anyio.to_thread.run_sync(partial(self._spaces.list_messages, source_id))
        return MessageListResponse(messages=[ChatMessage(**r) for r in rows])

    async def send_message(
        self, *, user: User, source_id: UUID, content: str
    ) -> SendMessageResponse:
        source = await anyio.to_thread.run_sync(
            partial(self._spaces.require_owned_source, user, source_id)
        )
        charge = await anyio.to_thread.run_sync(
            partial(self._credits.consume_ask, str(user.id))
        )
        try:
            return await self._send_message(
                user=user, source=source, source_id=source_id, content=content
            )
        except Exception:  # noqa: BLE001 - roll back ask metering before propagating
            await anyio.to_thread.run_sync(
                partial(self._credits.rollback_ask, str(user.id), charge)
            )
            raise

    async def _send_message(
        self, *, user: User, source: dict, source_id: UUID, content: str
    ) -> SendMessageResponse:
        # Guarantees a summary/extract exist even if this is the very first
        # interaction with the source (no prior "open" call happened).
        summary_resp = await self.get_or_create_summary(user=user, source_id=source_id)
        prior_rows = await anyio.to_thread.run_sync(partial(self._spaces.list_messages, source_id))
        extract = await self._retrieve_context(user=user, source=source, question=content)

        user_row = await anyio.to_thread.run_sync(
            partial(
                self._spaces.add_message,
                user=user,
                source_id=source_id,
                space_id=UUID(source["space_id"]),
                role="user",
                content=content,
            )
        )

        history = [{"role": r["role"], "content": r["content"]} for r in prior_rows]
        history.append({"role": "user", "content": content})

        reply = await self._llm.chat_reply(
            title=source["title"],
            source_type=source["type"],
            summary=summary_resp.summary,
            extract=extract,
            history=history,
        )

        assistant_row = await anyio.to_thread.run_sync(
            partial(
                self._spaces.add_message,
                user=user,
                source_id=source_id,
                space_id=UUID(source["space_id"]),
                role="assistant",
                content=reply,
            )
        )

        return SendMessageResponse(
            user_message=ChatMessage(**user_row),
            assistant_message=ChatMessage(**assistant_row),
        )

    async def _retrieve_context(self, *, user: User, source: dict, question: str) -> str:
        """Top-k relevant chunks for ``question``, or the full extract as a fallback.

        The fallback covers sources captured before this pipeline existed, or
        whose pipeline run failed — chat still works, just without retrieval.
        """
        query_embedding = await self._embeddings.embed_query(question)
        retrieved = await anyio.to_thread.run_sync(
            partial(
                self._chunks.search,
                source_id=str(source["id"]),
                user_id=str(user.id),
                query_embedding=query_embedding,
                k=RETRIEVAL_K,
            )
        )
        if not retrieved:
            return await self._extracts.read_extract(source)
        return "\n\n".join(f"[chunk {r['chunk_index']}] {r['content']}" for r in retrieved)