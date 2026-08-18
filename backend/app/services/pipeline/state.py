from __future__ import annotations

from typing import TypedDict

from app.services.pipeline.chunking import Chunk


class PipelineState(TypedDict, total=False):
    source_id: str
    space_id: str
    user_id: str
    source: dict
    extract: str
    chunks: list[Chunk]
    embeddings: list[list[float]]
    summary: str
    error: str | None
