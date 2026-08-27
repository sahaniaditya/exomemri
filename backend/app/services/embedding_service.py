"""Chunk/query vectors via Hugging Face Inference API (BGE-small)."""

from __future__ import annotations

import logging
import math
from typing import Any

from huggingface_hub import AsyncInferenceClient
from huggingface_hub.errors import HfHubHTTPError

from app.config import Settings
from app.errors import AppError, RateLimitError

logger = logging.getLogger(__name__)

# BGE retrieval models expect this instruction prefix on queries only.
# Documents are embedded without a prefix. See model card for BAAI/bge-small-en-v1.5.
_BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

# Transient HF serverless failures worth a single retry.
_RETRYABLE_STATUS = frozenset({503, 504})


class EmbeddingProviderError(AppError):
    """Upstream embedding provider failed after retries."""

    http_status = 502
    code = "embedding_provider_error"


class EmbeddingService:
    """Chunk/query vectors via Hugging Face serverless Inference API.

    Uses ``BAAI/bge-small-en-v1.5`` (384-d) by default. Anthropic has no
    embeddings endpoint, so this is a separate credential from ``LLMService``.
    """

    def __init__(self, settings: Settings) -> None:
        self._client = AsyncInferenceClient(token=settings.hf_token)
        self._model = settings.hf_embedding_model
        self._dimension = settings.hf_embedding_dimension

    @property
    def model_name(self) -> str:
        return self._model

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        return await self._embed(texts)

    async def embed_query(self, text: str) -> list[float]:
        vectors = await self._embed([f"{_BGE_QUERY_PREFIX}{text}"])
        return vectors[0]

    async def _embed(self, texts: list[str]) -> list[list[float]]:
        raw = await self._feature_extraction_with_retry(texts)
        vectors = _as_vector_list(raw)
        if len(vectors) != len(texts):
            raise EmbeddingProviderError(
                "Embedding provider returned unexpected batch size",
                detail={"expected": len(texts), "got": len(vectors)},
            )
        normalized = [_l2_normalize(v) for v in vectors]
        for v in normalized:
            if len(v) != self._dimension:
                raise EmbeddingProviderError(
                    "Embedding provider returned unexpected dimension",
                    detail={"expected": self._dimension, "got": len(v)},
                )
        return normalized

    async def _feature_extraction_with_retry(self, texts: list[str]) -> Any:
        last_exc: BaseException | None = None
        for attempt in range(2):
            try:
                return await self._client.feature_extraction(
                    texts,
                    model=self._model,
                )
            except HfHubHTTPError as exc:
                status = exc.response.status_code
                if status == 429:
                    raise RateLimitError(
                        "Embedding provider rate limit exceeded",
                        detail={"provider": "huggingface"},
                    ) from exc
                if status in _RETRYABLE_STATUS and attempt == 0:
                    logger.warning(
                        "embedding_provider_retry",
                        extra={"status": status, "attempt": attempt + 1},
                    )
                    last_exc = exc
                    continue
                raise EmbeddingProviderError(
                    "Embedding provider request failed",
                    detail={"status": status},
                ) from exc
            except TimeoutError as exc:
                if attempt == 0:
                    logger.warning(
                        "embedding_provider_retry",
                        extra={"reason": "timeout", "attempt": attempt + 1},
                    )
                    last_exc = exc
                    continue
                raise EmbeddingProviderError(
                    "Embedding provider timed out",
                ) from exc
        raise EmbeddingProviderError(
            "Embedding provider request failed after retry",
        ) from last_exc


def _as_vector_list(raw: Any) -> list[list[float]]:
    """Normalize HF ``feature_extraction`` output to a list of float vectors.

    The client returns a numpy ndarray shaped ``(batch, dim)`` for a list of
    texts, or ``(dim,)`` / nested lists depending on provider. Token-level
    outputs ``(batch, seq, dim)`` are mean-pooled as a last resort.
    """
    try:
        import numpy as np

        arr = np.asarray(raw, dtype=float)
    except Exception:  # noqa: BLE001 — fall through to list coercion
        arr = None

    if arr is not None:
        if arr.ndim == 1:
            return [arr.tolist()]
        if arr.ndim == 2:
            return arr.tolist()
        if arr.ndim == 3:
            # Mean-pool token embeddings → sentence vectors.
            return arr.mean(axis=1).tolist()

    if isinstance(raw, list) and raw and isinstance(raw[0], (int, float)):
        return [[float(x) for x in raw]]
    if isinstance(raw, list):
        out: list[list[float]] = []
        for item in raw:
            if isinstance(item, list) and item and isinstance(item[0], list):
                # Token-level nested list: mean-pool.
                seq = item
                dim = len(seq[0])
                pooled = [0.0] * dim
                for tok in seq:
                    for i, v in enumerate(tok):
                        pooled[i] += float(v)
                n = float(len(seq))
                out.append([v / n for v in pooled])
            else:
                out.append([float(x) for x in item])
        return out
    raise EmbeddingProviderError(
        "Embedding provider returned unrecognised payload shape",
    )


def _l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vector))
    if norm == 0.0:
        return vector
    return [x / norm for x in vector]
