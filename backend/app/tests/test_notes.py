"""Per-capture named note page tests."""

from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from app.schemas.notes import MAX_PAGES_PER_SOURCE
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


def test_list_notes_returns_empty(client: TestClient, space_repo: FakeSpaceRepo) -> None:
    source_id = _seed_article(space_repo)
    resp = client.get(f"/v1/sources/{source_id}/notes")
    assert resp.status_code == 200
    assert resp.json() == {"items": []}


def test_create_and_update_note_page(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    source_id = _seed_article(space_repo)
    created = client.post(f"/v1/sources/{source_id}/notes", json={})
    assert created.status_code == 201
    page = created.json()
    assert page["title"] == "Untitled"
    assert page["sort_order"] == 0
    assert page["content"]["type"] == "doc"
    note_id = page["id"]

    doc = {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "My agentic takeaways 🧠"}],
            }
        ],
    }
    put = client.put(
        f"/v1/sources/{source_id}/notes/{note_id}",
        json={"content": doc},
    )
    assert put.status_code == 200
    assert put.json()["content"] == doc
    assert put.json()["updated_at"] is not None

    renamed = client.put(
        f"/v1/sources/{source_id}/notes/{note_id}",
        json={"title": "  Key formulas  "},
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Key formulas"
    assert renamed.json()["content"] == doc

    listed = client.get(f"/v1/sources/{source_id}/notes")
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == note_id
    assert items[0]["title"] == "Key formulas"
    assert items[0]["content"] == doc


def test_create_second_page_appends_sort_order(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    source_id = _seed_article(space_repo)
    first = client.post(
        f"/v1/sources/{source_id}/notes", json={"title": "Interview prep"}
    )
    second = client.post(
        f"/v1/sources/{source_id}/notes", json={"title": "Follow-ups"}
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["sort_order"] == 0
    assert second.json()["sort_order"] == 1
    listed = client.get(f"/v1/sources/{source_id}/notes").json()["items"]
    titles = [item["title"] for item in listed]
    assert titles == ["Interview prep", "Follow-ups"]


def test_delete_note_page(client: TestClient, space_repo: FakeSpaceRepo) -> None:
    source_id = _seed_article(space_repo)
    created = client.post(f"/v1/sources/{source_id}/notes", json={"title": "Scratch"})
    note_id = created.json()["id"]
    deleted = client.delete(f"/v1/sources/{source_id}/notes/{note_id}")
    assert deleted.status_code == 204
    assert client.get(f"/v1/sources/{source_id}/notes").json()["items"] == []
    assert client.delete(f"/v1/sources/{source_id}/notes/{note_id}").status_code == 404


def test_update_requires_title_or_content(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    source_id = _seed_article(space_repo)
    note_id = client.post(f"/v1/sources/{source_id}/notes", json={}).json()["id"]
    resp = client.put(f"/v1/sources/{source_id}/notes/{note_id}", json={})
    assert resp.status_code == 422


def test_note_page_cap(client: TestClient, space_repo: FakeSpaceRepo) -> None:
    source_id = _seed_article(space_repo)
    for index in range(MAX_PAGES_PER_SOURCE):
        resp = client.post(
            f"/v1/sources/{source_id}/notes", json={"title": f"Page {index}"}
        )
        assert resp.status_code == 201
    overflow = client.post(f"/v1/sources/{source_id}/notes", json={"title": "Too many"})
    assert overflow.status_code == 409


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
