"""Chat endpoint tests: RAG retrieval and the full-extract fallback."""

from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from app.tests.conftest import SEEDED_SPACE_ID, FakeChunkRepo, FakeSpaceRepo, FakeStorage

DEV_USER = "00000000-0000-0000-0000-0000000000a1"
SPACE = SEEDED_SPACE_ID


def _seed_note_source(space_repo: FakeSpaceRepo, storage: FakeStorage, *, note_text: str) -> str:
    source_id = str(uuid4())
    prefix = f"users/{DEV_USER}/spaces/{SPACE}/sources/{source_id}"
    space_repo.sources[source_id] = {
        "id": source_id,
        "space_id": SPACE,
        "user_id": DEV_USER,
        "type": "note",
        "title": "My note",
        "url": None,
        "author": None,
        "storage_prefix": prefix,
        "content_hash": "hash",
        "processing_status": "queued",
        "captured_at": "2026-08-18T00:00:00+00:00",
        "summary_text": None,
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


def test_get_summary_generates_and_caches(
    client: TestClient, space_repo: FakeSpaceRepo, storage: FakeStorage
) -> None:
    source_id = _seed_note_source(space_repo, storage, note_text="note body")

    first = client.get(f"/v1/sources/{source_id}/summary")
    assert first.status_code == 200
    assert first.json()["generated"] is True

    second = client.get(f"/v1/sources/{source_id}/summary")
    assert second.status_code == 200
    assert second.json()["generated"] is False
    assert second.json()["summary"] == first.json()["summary"]
