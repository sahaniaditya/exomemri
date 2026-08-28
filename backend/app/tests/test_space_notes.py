"""Space-level named note page tests."""

from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from app.schemas.notes import MAX_PAGES_PER_SCOPE
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeStorage,
)

SPACE = SEEDED_SPACE_ID
DEV_USER = "00000000-0000-0000-0000-0000000000a1"


def test_list_space_notes_returns_empty(client: TestClient) -> None:
    resp = client.get(f"/v1/spaces/{SPACE}/notes")
    assert resp.status_code == 200
    assert resp.json() == {"items": []}


def test_create_and_update_space_note_page(client: TestClient) -> None:
    created = client.post(f"/v1/spaces/{SPACE}/notes", json={})
    assert created.status_code == 201
    page = created.json()
    assert page["title"] == "Untitled"
    assert page["sort_order"] == 0
    assert page["space_id"] == SPACE
    assert page["content"]["type"] == "doc"
    note_id = page["id"]

    doc = {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Space-wide takeaways"}],
            }
        ],
    }
    put = client.put(
        f"/v1/spaces/{SPACE}/notes/{note_id}",
        json={"content": doc},
    )
    assert put.status_code == 200
    assert put.json()["content"] == doc
    assert put.json()["updated_at"] is not None

    renamed = client.put(
        f"/v1/spaces/{SPACE}/notes/{note_id}",
        json={"title": "  Overview  "},
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Overview"
    assert renamed.json()["content"] == doc

    listed = client.get(f"/v1/spaces/{SPACE}/notes")
    assert listed.status_code == 200
    items = listed.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == note_id
    assert items[0]["title"] == "Overview"
    assert items[0]["content"] == doc


def test_create_second_space_page_appends_sort_order(client: TestClient) -> None:
    first = client.post(
        f"/v1/spaces/{SPACE}/notes", json={"title": "Concepts"}
    )
    second = client.post(
        f"/v1/spaces/{SPACE}/notes", json={"title": "Open questions"}
    )
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["sort_order"] == 0
    assert second.json()["sort_order"] == 1
    listed = client.get(f"/v1/spaces/{SPACE}/notes").json()["items"]
    titles = [item["title"] for item in listed]
    assert titles == ["Concepts", "Open questions"]


def test_delete_space_note_page(client: TestClient) -> None:
    created = client.post(f"/v1/spaces/{SPACE}/notes", json={"title": "Scratch"})
    note_id = created.json()["id"]
    deleted = client.delete(f"/v1/spaces/{SPACE}/notes/{note_id}")
    assert deleted.status_code == 204
    assert client.get(f"/v1/spaces/{SPACE}/notes").json()["items"] == []
    assert client.delete(f"/v1/spaces/{SPACE}/notes/{note_id}").status_code == 404


def test_update_space_note_requires_title_or_content(client: TestClient) -> None:
    note_id = client.post(f"/v1/spaces/{SPACE}/notes", json={}).json()["id"]
    resp = client.put(f"/v1/spaces/{SPACE}/notes/{note_id}", json={})
    assert resp.status_code == 422


def test_space_note_page_cap(client: TestClient) -> None:
    for index in range(MAX_PAGES_PER_SCOPE):
        resp = client.post(
            f"/v1/spaces/{SPACE}/notes", json={"title": f"Page {index}"}
        )
        assert resp.status_code == 201
    overflow = client.post(f"/v1/spaces/{SPACE}/notes", json={"title": "Too many"})
    assert overflow.status_code == 409


def test_space_note_image_upload_rejects_non_image(client: TestClient) -> None:
    resp = client.post(
        f"/v1/spaces/{SPACE}/note-images",
        json={"content_type": "application/pdf", "filename": "x.pdf"},
    )
    assert resp.status_code == 422 or resp.status_code == 400


def test_space_note_image_upload_mints_signed_url(
    client: TestClient, storage: FakeStorage
) -> None:
    resp = client.post(
        f"/v1/spaces/{SPACE}/note-images",
        json={"content_type": "image/png", "filename": "shot.png"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["key"].startswith("notes/images/")
    assert body["key"].endswith(".png")
    assert body["token"] == "faketoken"
    assert body["path"] == f"users/{DEV_USER}/spaces/{SPACE}/{body['key']}"
    assert body["upload_url"].startswith("https://test.supabase.co/storage/v1")
    assert body["path"] in storage.signed_urls


def test_space_note_artifact_url(client: TestClient, storage: FakeStorage) -> None:
    key = "notes/images/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png"
    resp = client.get(
        f"/v1/spaces/{SPACE}/note-artifact-url",
        params={"key": key},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "url" in body
    assert body["expires_in"] == 300
    assert storage.read_urls[-1][0] == f"users/{DEV_USER}/spaces/{SPACE}/{key}"


def test_space_note_artifact_url_rejects_bad_key(client: TestClient) -> None:
    resp = client.get(
        f"/v1/spaces/{SPACE}/note-artifact-url",
        params={"key": "raw/meta.json"},
    )
    assert resp.status_code == 422 or resp.status_code == 400


def test_space_notes_require_owned_space(client: TestClient) -> None:
    resp = client.get(f"/v1/spaces/{OTHER_USER_SPACE_ID}/notes")
    assert resp.status_code == 403 or resp.status_code == 404
    missing = str(uuid4())
    resp = client.get(f"/v1/spaces/{missing}/notes")
    assert resp.status_code == 404
