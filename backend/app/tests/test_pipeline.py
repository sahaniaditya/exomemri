"""RAG pipeline tests: chunk -> embed -> summarize -> extract -> ready, against fakes."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from app.schemas.common import User
from app.services.concept_service import ConceptService
from app.services.pipeline_service import PipelineService
from app.services.review_service import ReviewService
from app.services.space_service import SpaceService
from app.services.streak_service import StreakService
from app.tests.conftest import (
    SEEDED_SPACE_ID,
    FakeChunkRepo,
    FakeCollaboratorRepo,
    FakeConceptRepo,
    FakeEmbeddingService,
    FakeLLMService,
    FakeProfileRepo,
    FakeReviewRepo,
    FakeSpaceRepo,
    FakeStorage,
)

DEV_USER_ID = "00000000-0000-0000-0000-0000000000a1"


class FailingExtractService:
    """Simulates a storage read failure inside the pipeline's first node."""

    async def read_full_extract(self, source: dict) -> str:  # noqa: ARG002
        raise RuntimeError("storage unavailable")


def _seed_source(space_repo: FakeSpaceRepo, storage: FakeStorage, *, extract_text: str) -> dict:
    source_id = str(uuid4())
    prefix = f"users/{DEV_USER_ID}/spaces/{SEEDED_SPACE_ID}/sources/{source_id}"
    row = {
        "id": source_id,
        "space_id": SEEDED_SPACE_ID,
        "user_id": DEV_USER_ID,
        "type": "article",
        "title": "A long article",
        "url": None,
        "author": None,
        "storage_prefix": prefix,
        "content_hash": "hash",
        "processing_status": "queued",
        "captured_at": "2026-08-18T00:00:00+00:00",
    }
    space_repo.sources[source_id] = row
    storage.uploads[f"{prefix}/raw/extracted.txt"] = (
        extract_text.encode("utf-8"),
        "text/plain",
    )
    return row


@pytest.fixture
def dev_user() -> User:
    return User(id=DEV_USER_ID, email="dev@atlas.ai")  # type: ignore[arg-type]


def _build_pipeline_service(
    *,
    extracts,
    space_repo: FakeSpaceRepo,
    llm: FakeLLMService,
    embeddings,
    chunks: FakeChunkRepo,
    concepts: FakeConceptRepo,
    reviews: FakeReviewRepo,
) -> PipelineService:
    space_svc = SpaceService(space_repo, FakeCollaboratorRepo())  # type: ignore[arg-type]
    concept_svc = ConceptService(concepts, space_svc, extracts, llm)  # type: ignore[arg-type]
    streak_svc = StreakService(FakeProfileRepo())  # type: ignore[arg-type]
    review_svc = ReviewService(reviews, space_svc, streak_svc)  # type: ignore[arg-type]
    return PipelineService(concept_svc, review_svc, extracts, embeddings, llm, chunks, space_svc)


async def test_pipeline_chunks_embeds_and_summarizes(
    dev_user: User,
    space_repo: FakeSpaceRepo,
    storage: FakeStorage,
    chunk_repo: FakeChunkRepo,
    embedding_service: FakeEmbeddingService,
    llm_service: FakeLLMService,
    concept_repo: FakeConceptRepo,
    review_repo: FakeReviewRepo,
) -> None:
    from app.services.extract_service import ExtractService

    text = "\n\n".join(f"Paragraph {i} " * 40 for i in range(6))
    source = _seed_source(space_repo, storage, extract_text=text)
    extracts = ExtractService(storage)  # type: ignore[arg-type]

    pipeline = _build_pipeline_service(
        extracts=extracts,
        space_repo=space_repo,
        llm=llm_service,
        embeddings=embedding_service,
        chunks=chunk_repo,
        concepts=concept_repo,
        reviews=review_repo,
    )

    await pipeline.run(
        user=dev_user, source_id=UUID(source["id"]), space_id=UUID(source["space_id"])
    )

    assert space_repo.sources[source["id"]]["processing_status"] == "ready"
    assert space_repo.sources[source["id"]]["summary_text"] == "Summary of A long article"
    assert len(space_repo.sources[source["id"]]["summary_sections"]["tldr"]) == 5
    stored_chunks = chunk_repo.chunks_by_source[source["id"]]
    assert len(stored_chunks) > 1
    assert all(c["embedding"] for c in stored_chunks)
    assert [c["chunk_index"] for c in stored_chunks] == list(range(len(stored_chunks)))
    review_items = [r for r in review_repo.items.values() if r["source_id"] == source["id"]]
    assert len(review_items) == 1
    assert review_items[0]["prompt_text"] == "Explain A long article"
    assert space_repo.sources[source["id"]]["review_items_extracted_at"] is not None


async def test_pipeline_marks_failed_on_node_exception(
    dev_user: User,
    space_repo: FakeSpaceRepo,
    storage: FakeStorage,
    chunk_repo: FakeChunkRepo,
    embedding_service: FakeEmbeddingService,
    llm_service: FakeLLMService,
    concept_repo: FakeConceptRepo,
    review_repo: FakeReviewRepo,
) -> None:
    source = _seed_source(space_repo, storage, extract_text="irrelevant")

    pipeline = _build_pipeline_service(
        extracts=FailingExtractService(),
        space_repo=space_repo,
        llm=llm_service,
        embeddings=embedding_service,
        chunks=chunk_repo,
        concepts=concept_repo,
        reviews=review_repo,
    )

    await pipeline.run(
        user=dev_user, source_id=UUID(source["id"]), space_id=UUID(source["space_id"])
    )

    assert space_repo.sources[source["id"]]["processing_status"] == "failed"
    assert source["id"] not in chunk_repo.chunks_by_source
