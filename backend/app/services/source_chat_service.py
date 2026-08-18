from __future__ import annotations

from datetime import UTC, datetime
from functools import partial
from uuid import UUID

import anyio

from app.repositories.chunk_repo import ChunkRepo
from app.schemas.common import User
from app.schemas.sources import (
    ChatMessage,
    MessageListResponse,
    SendMessageResponse,
    SummaryResponse,
)
from app.services.embedding_service import EmbeddingService
from app.services.extract_service import ExtractService
from app.services.llm_service import LLMService
from app.services.space_service import SpaceService

# Top-k chunks retrieved per question — enough context without overrunning
# the prompt budget the way the old full-extract approach could.
RETRIEVAL_K = 6


class SourceChatService:
    def __init__(
        self,
        spaces: SpaceService,
        extracts: ExtractService,
        llm: LLMService,
        embeddings: EmbeddingService,
        chunks: ChunkRepo,
    ) -> None:
        self._spaces = spaces
        self._extracts = extracts
        self._llm = llm
        self._embeddings = embeddings
        self._chunks = chunks

    async def get_or_create_summary(self, *, user: User, source_id: UUID) -> SummaryResponse:
        source = await anyio.to_thread.run_sync(
            partial(self._spaces.require_owned_source, user, source_id)
        )
        if source.get("summary_text"):
            return SummaryResponse(
                summary=source["summary_text"],
                generated=False,
                model=source.get("summary_model"),
                summarized_at=source.get("summarized_at"),
            )

        extract = await self._extracts.read_extract(source)
        summary = await self._llm.summarize(title=source["title"], extract=extract)
        await anyio.to_thread.run_sync(
            partial(
                self._spaces.save_summary,
                source_id=source_id,
                summary=summary,
                model=self._llm.model_name,
            )
        )
        return SummaryResponse(
            summary=summary,
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