from __future__ import annotations

import voyageai

from app.config import Settings


class EmbeddingService:
    """Chunk/query vectors via Voyage AI.

    A separate credential and service from ``LLMService`` (Anthropic) because
    Anthropic has no embeddings endpoint — Voyage is Anthropic's recommended
    embedding partner.
    """

    def __init__(self, settings: Settings) -> None:
        self._client = voyageai.AsyncClient(api_key=settings.voyage_api_key)
        self._model = settings.voyage_model_name
        self._dimension = settings.voyage_embedding_dimension

    @property
    def model_name(self) -> str:
        return self._model

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        result = await self._client.embed(
            texts,
            model=self._model,
            input_type="document",
            output_dimension=self._dimension,
        )
        return result.embeddings

    async def embed_query(self, text: str) -> list[float]:
        result = await self._client.embed(
            [text],
            model=self._model,
            input_type="query",
            output_dimension=self._dimension,
        )
        return result.embeddings[0]
