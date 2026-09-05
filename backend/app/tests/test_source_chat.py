"""Chat endpoint tests: RAG retrieval and the full-extract fallback."""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.schemas.sources import StructuredSummary
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeChunkRepo,
    FakeCollaboratorRepo,
    FakeCreditsRepo,
    FakeLLMService,
    FakeSpaceRepo,
    FakeStorage,
)

DEV_USER = "00000000-0000-0000-0000-0000000000a1"
OTHER_USER = "00000000-0000-0000-0000-0000000000ff"
SPACE = SEEDED_SPACE_ID

_CACHED_SECTIONS = {
    "tldr": [f"point {i}" for i in range(5)],
    "key_concepts": ["a concept"],
    "examples": ["an example"],
    "interview_points": ["a question"],
}


def test_structured_summary_accepts_long_detailed_bullets() -> None:
    long_point = "A detailed finding. " * 80
    summary = StructuredSummary(
        tldr=[f"{long_point} {i}" for i in range(5)],
        key_concepts=["a concept"],
        examples=[long_point],
        interview_points=[long_point],
    )
    assert all(len(item) > 500 for item in summary.tldr)


@pytest.mark.parametrize("bullet_count", [4, 11])
def test_structured_summary_rejects_wrong_tldr_bullet_count(bullet_count: int) -> None:
    with pytest.raises(ValidationError):
        StructuredSummary(
            tldr=[f"point {i}" for i in range(bullet_count)],
            key_concepts=["a concept"],
            examples=["an example"],
            interview_points=["a question"],
        )


def _seed_note_source(
    space_repo: FakeSpaceRepo,
    storage: FakeStorage,
    *,
    note_text: str,
    processing_status: str = "ready",
    user_id: str = DEV_USER,
    space_id: str = SPACE,
) -> str:
    source_id = str(uuid4())
    prefix = f"users/{user_id}/spaces/{space_id}/sources/{source_id}"
    space_repo.sources[source_id] = {
        "id": source_id,
        "space_id": space_id,
        "user_id": user_id,
        "type": "note",
        "title": "My note",
        "url": None,
        "author": None,
        "storage_prefix": prefix,
        "content_hash": "hash",
        "processing_status": processing_status,
        "captured_at": "2026-08-18T00:00:00+00:00",
        "summary_text": None,
        "summary_sections": None,
        "summary_model": None,
        "summarized_at": None,
    }
    storage.uploads[f"{prefix}/raw/note.txt"] = (note_text.encode("utf-8"), "text/plain")
    return source_id


def test_send_message_retrieves_chunks_when_the_pipeline_has_run(
    client: TestClient, space_repo: FakeSpaceRepo, storage: FakeStorage, chunk_repo: FakeChunkRepo
) -> None:
    source_id = _seed_note_source(space_repo, storage, note_text="full note text")
    chunk_repo.chunks_by_source[source_id] = [
        {
            "id": str(uuid4()),
            "chunk_index": 0,
            "content": "The capital of France is Paris.",
            "embedding": [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        },
        {
            "id": str(uuid4()),
            "chunk_index": 1,
            "content": "Unrelated trivia about volcanoes.",
            "embedding": [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        },
    ]

    resp = client.post(f"/v1/sources/{source_id}/messages", json={"content": "capital?"})

    assert resp.status_code == 200
    reply = resp.json()["assistant_message"]["content"]
    assert "[chunk" in reply
    assert "full note text" not in reply


def test_send_message_falls_back_to_full_extract_without_chunks(
    client: TestClient, space_repo: FakeSpaceRepo, storage: FakeStorage
) -> None:
    source_id = _seed_note_source(space_repo, storage, note_text="the only content here")

    resp = client.post(f"/v1/sources/{source_id}/messages", json={"content": "anything"})

    assert resp.status_code == 200
    reply = resp.json()["assistant_message"]["content"]
    assert "the only content here" in reply
    assert "[chunk" not in reply


def test_get_summary_miss_does_not_generate(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    storage: FakeStorage,
    llm_service: FakeLLMService,
    credits_repo: FakeCreditsRepo,
) -> None:
    source_id = _seed_note_source(
        space_repo, storage, note_text="note body", processing_status="failed"
    )
    credits_repo.ensure(user_id=DEV_USER)

    resp = client.get(f"/v1/sources/{source_id}/summary")
    assert resp.status_code == 200
    assert resp.json()["generated"] is False
    assert resp.json()["summary"] is None
    assert resp.json()["sections"] is None
    assert space_repo.sources[source_id]["summary_text"] is None
    assert llm_service.bundle_calls == 0


def test_get_summary_skips_while_processing(
    client: TestClient, space_repo: FakeSpaceRepo, storage: FakeStorage, llm_service: FakeLLMService
) -> None:
    source_id = _seed_note_source(
        space_repo, storage, note_text="note body", processing_status="queued"
    )

    resp = client.get(f"/v1/sources/{source_id}/summary")

    assert resp.status_code == 200
    assert resp.json()["generated"] is False
    assert resp.json()["sections"] is None
    assert space_repo.sources[source_id]["summary_text"] is None
    assert llm_service.bundle_calls == 0


def test_get_summary_cache_hit_while_extracting_does_not_call_llm(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    storage: FakeStorage,
    llm_service: FakeLLMService,
) -> None:
    source_id = _seed_note_source(
        space_repo, storage, note_text="note body", processing_status="extracting"
    )
    space_repo.sources[source_id]["summary_text"] = "Pipeline summary"
    space_repo.sources[source_id]["summary_sections"] = _CACHED_SECTIONS
    space_repo.sources[source_id]["summary_model"] = "fake-llm"
    space_repo.sources[source_id]["summarized_at"] = "2026-08-18T00:00:00+00:00"

    resp = client.get(f"/v1/sources/{source_id}/summary")

    assert resp.status_code == 200
    assert resp.json()["generated"] is False
    assert resp.json()["summary"] == "Pipeline summary"
    assert llm_service.bundle_calls == 0


def test_get_summary_pre_migration_row_is_a_miss(
    client: TestClient, space_repo: FakeSpaceRepo, storage: FakeStorage, llm_service: FakeLLMService
) -> None:
    """A row with summary_text set but no summary_sections (captured before this
    feature shipped) is a cache miss — GET does not regenerate."""
    source_id = _seed_note_source(space_repo, storage, note_text="note body")
    space_repo.sources[source_id]["summary_text"] = "Old prose summary"
    space_repo.sources[source_id]["summary_model"] = "old-model"

    resp = client.get(f"/v1/sources/{source_id}/summary")

    assert resp.status_code == 200
    assert resp.json()["generated"] is False
    assert resp.json()["sections"] is None
    assert llm_service.bundle_calls == 0


def test_get_summary_collaborator_does_not_generate_on_miss(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    storage: FakeStorage,
    collaborator_repo: FakeCollaboratorRepo,
    llm_service: FakeLLMService,
) -> None:
    source_id = _seed_note_source(
        space_repo,
        storage,
        note_text="note body",
        processing_status="failed",
        user_id=OTHER_USER,
        space_id=OTHER_USER_SPACE_ID,
    )
    collaborator_repo.add(
        source_id=source_id,
        space_id=OTHER_USER_SPACE_ID,
        user_id=DEV_USER,
        invited_by=OTHER_USER,
    )

    resp = client.get(f"/v1/sources/{source_id}/summary")

    assert resp.status_code == 200
    assert resp.json()["generated"] is False
    assert resp.json()["sections"] is None
    assert space_repo.sources[source_id]["summary_text"] is None
    assert llm_service.bundle_calls == 0


def test_ask_without_summary_still_replies(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    storage: FakeStorage,
) -> None:
    source_id = _seed_note_source(
        space_repo, storage, note_text="note body", processing_status="queued"
    )

    resp = client.post(f"/v1/sources/{source_id}/messages", json={"content": "hello?"})

    assert resp.status_code == 200
    assert space_repo.sources[source_id]["summary_text"] is None


def test_ask_returns_402_when_out_of_credits(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    storage: FakeStorage,
    credits_repo: FakeCreditsRepo,
) -> None:
    source_id = _seed_note_source(space_repo, storage, note_text="note body")
    credits_repo.ensure(user_id=DEV_USER)
    credits_repo.rows[DEV_USER]["balance"] = 0
    resp = client.post(f"/v1/sources/{source_id}/messages", json={"content": "hello?"})
    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "credits_exhausted"
    assert space_repo.sources[source_id]["summary_text"] is None
