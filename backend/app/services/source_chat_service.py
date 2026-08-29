from __future__ import annotations

from functools import partial
from uuid import UUID

import anyio

from app.repositories.chunk_repo import ChunkRepo
from app.schemas.common import User
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


def _cached_summary(source: dict) -> SummaryResponse | None:
    # Pre-migration rows have summary_text but no summary_sections — treat as a
    # miss. Generation lives in the capture pipeline, not on GET.
    if not (source.get("summary_text") and source.get("summary_sections")):
        return None
    return SummaryResponse(
        summary=source["summary_text"],
        sections=StructuredSummary(**source["summary_sections"]),
        generated=False,
        model=source.get("summary_model"),
        summarized_at=source.get("summarized_at"),
    )


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

    async def get_summary(self, *, user: User, source_id: UUID) -> SummaryResponse:
        # A superset of ownership — lets a read-only collaborator see a
        # source's summary without granting them any write access. Chat
        # (list/send messages) stays strictly owner-only, unaffected.
        source = await anyio.to_thread.run_sync(
            partial(self._spaces.require_viewable_source, user, source_id)
        )
        cached = _cached_summary(source)
        if cached is not None:
            return cached
        return SummaryResponse(
            summary=None,
            sections=None,
            generated=False,
            model=None,
            summarized_at=None,
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
        cached = _cached_summary(source)
        summary_text = cached.summary if cached and cached.summary else ""
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
            summary=summary_text,
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
