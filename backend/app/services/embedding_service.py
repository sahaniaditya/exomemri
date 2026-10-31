"""Chunk/query vectors via a local sentence-transformers model (BGE-small)."""

from __future__ import annotations

import asyncio
import logging
import threading
from typing import TYPE_CHECKING

from app.config import Settings
from app.errors import AppError

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# BGE retrieval models expect this instruction prefix on queries only.
# Documents are embedded without a prefix. See model card for BAAI/bge-small-en-v1.5.
_BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

# Texts per encode call. Keeps each worker-thread call short so the event
# loop and other requests are never blocked for long on big documents.
EMBED_BATCH_SIZE = 32


class EmbeddingProviderError(AppError):
    """Local embedding model failed."""

    http_status = 502
    code = "embedding_provider_error"




_MODEL_LOCK = threading.Lock()
_MODELS: dict[str, SentenceTransformer] = {}


def _load_model(model_name: str) -> SentenceTransformer:
    with _MODEL_LOCK:
        model = _MODELS.get(model_name)
        if model is None:
            from sentence_transformers import SentenceTransformer

            logger.info("embedding_model_loading", extra={"model": model_name})
            model = SentenceTransformer(model_name)
            model.max_seq_length = 512
            _MODELS[model_name] = model
        return model


class EmbeddingService:
    """Chunk/query vectors from a locally loaded ``BAAI/bge-small-en-v1.5`` (384-d).

    Runs in-process: no API key, no quota. The model is cached per process, so
    constructing this service more than once does not reload it. Anthropic has
    no embeddings endpoint, so this is independent of ``LLMService``.
    """

    def __init__(self, settings: Settings) -> None:
        self._model_name = settings.hf_embedding_model
        self._dimension = settings.hf_embedding_dimension
        try:
            self._model = _load_model(self._model_name)
        except Exception as exc:  # noqa: BLE001
            raise EmbeddingProviderError(
                "Failed to load embedding model",
                detail={"model": self._model_name},
            ) from exc

        actual = self._model.get_sentence_embedding_dimension()
        if actual != self._dimension:
            raise EmbeddingProviderError(
                "Embedding model dimension does not match configuration",
                detail={"expected": self._dimension, "got": actual},
            )
        # One encode at a time: it is CPU-bound, and parallel calls would
        # only fight over the same cores.
        self._gate = asyncio.Semaphore(1)

    @property
    def model_name(self) -> str:
        return self._model_name

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors: list[list[float]] = []
        for start in range(0, len(texts), EMBED_BATCH_SIZE):
            batch = texts[start : start + EMBED_BATCH_SIZE]
            vectors.extend(await self._embed(batch))
        return vectors

    async def embed_query(self, text: str) -> list[float]:
        vectors = await self._embed([f"{_BGE_QUERY_PREFIX}{text}"])
        return vectors[0]

    async def _embed(self, texts: list[str]) -> list[list[float]]:
        async with self._gate:
            try:
                vectors = await asyncio.to_thread(self._encode, texts)
            except Exception as exc:  # noqa: BLE001
                raise EmbeddingProviderError(
                    "Embedding model failed to encode",
                ) from exc
        if len(vectors) != len(texts):
            raise EmbeddingProviderError(
                "Embedding model returned unexpected batch size",
                detail={"expected": len(texts), "got": len(vectors)},
            )
        return vectors

    def _encode(self, texts: list[str]) -> list[list[float]]:
        # normalize_embeddings=True gives unit-length vectors, the same as the
        # old _l2_normalize step, so stored and new vectors stay comparable.
        arr = self._model.encode(
            texts,
            batch_size=EMBED_BATCH_SIZE,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return arr.tolist()