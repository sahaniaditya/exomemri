"""Per-capture user notebook tests."""

from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from app.tests.conftest import SEEDED_SPACE_ID, FakeSpaceRepo, FakeStorage

DEV_USER = "00000000-0000-0000-0000-0000000000a1"
SPACE = SEEDED_SPACE_ID


def _seed_article(space_repo: FakeSpaceRepo) -> str:
    source_id = str(uuid4())
    prefix = f"users/{DEV_USER}/spaces/{SPACE}/sources/{source_id}"
    space_repo.sources[source_id] = {
        "id": source_id,
        "space_id": SPACE,
        "user_id": DEV_USER,
        "type": "article",
        "title": "Agentic AI",
        "url": "https://example.com/agentic",
        "author": None,
        "storage_prefix": prefix,
        "content_hash": "hash-notes",
        "processing_status": "ready",
        "captured_at": "2026-08-22T00:00:00+00:00",
        "summary_text": None,
        "summary_sections": None,
        "summary_model": None,
        "summarized_at": None,
    }
    return source_id


def test_get_note_returns_empty_doc(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    source_id = _seed_article(space_repo)
    resp = client.get(f"/v1/sources/{source_id}/notes")
    assert resp.status_code == 200
    body = resp.json()
    assert body["source_id"] == source_id
    assert body["updated_at"] is None
    assert body["content"]["type"] == "doc"


def test_upsert_note_persists_content(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    source_id = _seed_article(space_repo)
    doc = {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "My agentic takeaways 🧠"}],
            }
        ],
    }
    put = client.put(f"/v1/sources/{source_id}/notes", json={"content": doc})
    assert put.status_code == 200
    assert put.json()["content"] == doc
    assert put.json()["updated_at"] is not None

    got = client.get(f"/v1/sources/{source_id}/notes")
    assert got.status_code == 200
    assert got.json()["content"] == doc


def test_note_image_upload_rejects_non_image(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    source_id = _seed_article(space_repo)
    resp = client.post(
        f"/v1/sources/{source_id}/note-images",
        json={"content_type": "application/pdf", "filename": "x.pdf"},
    )
    assert resp.status_code == 422 or resp.status_code == 400


def test_note_image_upload_mints_signed_url(
    client: TestClient, space_repo: FakeSpaceRepo, storage: FakeStorage
) -> None:
    source_id = _seed_article(space_repo)
    resp = client.post(
        f"/v1/sources/{source_id}/note-images",
        json={"content_type": "image/png", "filename": "shot.png"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["key"].startswith("notes/images/")
    assert body["key"].endswith(".png")
    assert body["token"] == "faketoken"
    assert body["path"].endswith(body["key"])
    assert body["upload_url"].startswith("https://test.supabase.co/storage/v1")
    assert body["path"] in storage.signed_urls


def test_notes_require_owned_source(client: TestClient) -> None:
    missing = str(uuid4())
    resp = client.get(f"/v1/sources/{missing}/notes")
    assert resp.status_code == 404
