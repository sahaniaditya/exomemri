"""Unit tests for embedding batching and concept merge helpers."""

from __future__ import annotations

import pytest

from app.schemas.concepts import ExtractedConcept
from app.services.embedding_service import EMBED_BATCH_SIZE, EmbeddingService
from app.services.llm_service import merge_extracted_concepts


def test_merge_extracted_concepts_keeps_highest_weight_per_slug() -> None:
    merged = merge_extracted_concepts(
        [
            ExtractedConcept(label="Load balancing", weight=0.4),
            ExtractedConcept(label="Load Balancing", weight=0.9),
            ExtractedConcept(label="Consistent hashing", weight=0.7),
            ExtractedConcept(label="Consistent hashing", weight=0.2),
        ]
    )
    by_label = {c.label.lower(): c.weight for c in merged}
    assert by_label["load balancing"] == 0.9
    assert by_label["consistent hashing"] == 0.7
    assert len(merged) == 2


def test_merge_extracted_concepts_respects_limit() -> None:
    concepts = [
        ExtractedConcept(label=f"Concept {i}", weight=1.0 - (i * 0.05)) for i in range(12)
    ]
    merged = merge_extracted_concepts(concepts, limit=8)
    assert len(merged) == 8
    assert merged[0].weight >= merged[-1].weight


async def test_embed_documents_batches_upstream_calls(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[int] = []

    class _Settings:
        hf_token = "fake"
        hf_embedding_model = "fake-model"
        hf_embedding_dimension = 8

    service = EmbeddingService(_Settings())  # type: ignore[arg-type]

    async def fake_embed(texts: list[str]) -> list[list[float]]:
        calls.append(len(texts))
        return [[float(i)] * 8 for i, _ in enumerate(texts)]

    monkeypatch.setattr(service, "_embed", fake_embed)

    texts = [f"chunk-{i}" for i in range(EMBED_BATCH_SIZE + 5)]
    vectors = await service.embed_documents(texts)

    assert len(vectors) == len(texts)
    assert calls == [EMBED_BATCH_SIZE, 5]
