"""The chunk/embed/summarize/extract pipeline, as a linear LangGraph state machine.

Each stage node advances ``sources.processing_status`` to the matching
``ProcessingStatus`` value before doing its work. Any node exception is
caught, recorded on ``state["error"]``, and routed to ``mark_failed`` via a
conditional edge instead of raising past the graph — a ``BackgroundTasks``
callable that raises is otherwise invisible.
"""

from __future__ import annotations

import logging
from functools import partial
from typing import TYPE_CHECKING

import anyio
from langgraph.graph import END, StateGraph

from app.schemas.common import ProcessingStatus
from app.services.pipeline.chunking import chunk_text
from app.services.pipeline.state import PipelineState

if TYPE_CHECKING:
    from langgraph.graph.state import CompiledStateGraph

    from app.repositories.chunk_repo import ChunkRepo
    from app.services.concept_service import ConceptService
    from app.services.embedding_service import EmbeddingService
    from app.services.extract_service import ExtractService
    from app.services.llm_service import LLMService
    from app.services.space_service import SpaceService

logger = logging.getLogger(__name__)


def _route_after(node: str) -> str:
    """Conditional-edge target: the next stage, or ``mark_failed`` if it set an error."""

    def _route(state: PipelineState) -> str:
        return "mark_failed" if state.get("error") else node

    return _route


def build_pipeline(
    *,
    concepts: ConceptService,
    extracts: ExtractService,
    embeddings: EmbeddingService,
    llm: LLMService,
    chunks: ChunkRepo,
    space_service: SpaceService,
) -> CompiledStateGraph:
    async def fetch_extract(state: PipelineState) -> PipelineState:
        try:
            await anyio.to_thread.run_sync(
                partial(
                    space_service.update_processing_status,
                    source_id=state["source_id"],
                    status=ProcessingStatus.fetching.value,
                )
            )
            extract = await extracts.read_full_extract(state["source"])
            return {**state, "extract": extract}
        except Exception as exc:  # noqa: BLE001 - graph must never raise
            logger.error("pipeline_fetch_failed", extra={"source_id": state["source_id"]})
            return {**state, "error": str(exc)}

    async def chunk(state: PipelineState) -> PipelineState:
        try:
            await anyio.to_thread.run_sync(
                partial(
                    space_service.update_processing_status,
                    source_id=state["source_id"],
                    status=ProcessingStatus.chunking.value,
                )
            )
            return {**state, "chunks": chunk_text(state["extract"])}
        except Exception as exc:  # noqa: BLE001 - graph must never raise
            logger.error("pipeline_chunk_failed", extra={"source_id": state["source_id"]})
            return {**state, "error": str(exc)}

    async def embed(state: PipelineState) -> PipelineState:
        try:
            await anyio.to_thread.run_sync(
                partial(
                    space_service.update_processing_status,
                    source_id=state["source_id"],
                    status=ProcessingStatus.embedding.value,
                )
            )
            chunk_list = state["chunks"]
            vectors = (
                await embeddings.embed_documents([c.content for c in chunk_list])
                if chunk_list
                else []
            )
            chunk_rows = [
                {
                    "source_id": state["source_id"],
                    "space_id": state["space_id"],
                    "user_id": state["user_id"],
                    "chunk_index": c.index,
                    "content": c.content,
                    "token_count": c.token_count,
                    "embedding": vector,
                }
                for c, vector in zip(chunk_list, vectors, strict=True)
            ]
            await anyio.to_thread.run_sync(
                partial(chunks.replace_chunks, source_id=state["source_id"], chunks=chunk_rows)
            )
            return {**state, "embeddings": vectors}
        except Exception as exc:  # noqa: BLE001 - graph must never raise
            logger.error("pipeline_embed_failed", extra={"source_id": state["source_id"]})
            return {**state, "error": str(exc)}

    async def summarize(state: PipelineState) -> PipelineState:
        try:
            await anyio.to_thread.run_sync(
                partial(
                    space_service.update_processing_status,
                    source_id=state["source_id"],
                    status=ProcessingStatus.summarizing.value,
                )
            )
            summary, sections = await llm.summarize_document_bundle(
                title=state["source"]["title"], extract=state["extract"]
            )
            await anyio.to_thread.run_sync(
                partial(
                    space_service.save_summary,
                    source_id=state["source_id"],
                    summary=summary,
                    sections=sections.model_dump(),
                    model=llm.model_name,
                )
            )
            return {**state, "summary": summary, "summary_sections": sections.model_dump()}
        except Exception as exc:  # noqa: BLE001 - graph must never raise
            logger.error("pipeline_summarize_failed", extra={"source_id": state["source_id"]})
            return {**state, "error": str(exc)}

    async def extract_concepts(state: PipelineState) -> PipelineState:
        """Map the source onto its space's concepts — the knowledge-map stage.

        Deliberately the last real stage: it depends on nothing downstream, so a
        failure here should not cost the user their chunks, embeddings or summary.
        """
        try:
            await anyio.to_thread.run_sync(
                partial(
                    space_service.update_processing_status,
                    source_id=state["source_id"],
                    status=ProcessingStatus.extracting.value,
                )
            )
            count = await concepts.extract_for_source(
                source=state["source"], extract=state["extract"]
            )
            return {**state, "concept_count": count}
        except Exception as exc:  # noqa: BLE001 - graph must never raise
            logger.error(
                "pipeline_extract_concepts_failed", extra={"source_id": state["source_id"]}
            )
            return {**state, "error": str(exc)}

    async def finalize(state: PipelineState) -> PipelineState:
        await anyio.to_thread.run_sync(
            partial(
                space_service.update_processing_status,
                source_id=state["source_id"],
                status=ProcessingStatus.ready.value,
            )
        )
        return state

    async def mark_failed(state: PipelineState) -> PipelineState:
        logger.error(
            "pipeline_failed",
            extra={"source_id": state["source_id"], "error": state.get("error")},
        )
        await anyio.to_thread.run_sync(
            partial(
                space_service.update_processing_status,
                source_id=state["source_id"],
                status=ProcessingStatus.failed.value,
            )
        )
        return state

    graph: StateGraph = StateGraph(PipelineState)
    graph.add_node("fetch_extract", fetch_extract)
    graph.add_node("chunk", chunk)
    graph.add_node("embed", embed)
    graph.add_node("summarize", summarize)
    graph.add_node("extract_concepts", extract_concepts)
    graph.add_node("finalize", finalize)
    graph.add_node("mark_failed", mark_failed)

    graph.set_entry_point("fetch_extract")
    graph.add_conditional_edges("fetch_extract", _route_after("chunk"))
    graph.add_conditional_edges("chunk", _route_after("embed"))
    graph.add_conditional_edges("embed", _route_after("summarize"))
    graph.add_conditional_edges("summarize", _route_after("extract_concepts"))
    graph.add_conditional_edges("extract_concepts", _route_after("finalize"))
    graph.add_edge("finalize", END)
    graph.add_edge("mark_failed", END)

    return graph.compile()
