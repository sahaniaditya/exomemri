"""Learning Space endpoint tests (/v1/spaces)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.services.space_service import slugify
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeSpaceRepo,
    FakeStorage,
)

DEV_USER = "00000000-0000-0000-0000-0000000000a1"


def test_create_space_returns_slug_and_appears_in_list(client: TestClient) -> None:
    resp = client.post("/v1/spaces", json={"name": "Claude Code"})
    assert resp.status_code == 201
    created = resp.json()
    assert created["name"] == "Claude Code"
    assert created["slug"] == "claude-code"
    assert created["source_counts"]["total"] == 0

    names = [s["name"] for s in client.get("/v1/spaces").json()["spaces"]]
    assert "Claude Code" in names


def test_create_space_rejects_a_duplicate_name(client: TestClient) -> None:
    client.post("/v1/spaces", json={"name": "Claude Code"})
    resp = client.post("/v1/spaces", json={"name": "claude code"})
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "conflict"


def test_create_space_rejects_a_too_short_name(client: TestClient) -> None:
    resp = client.post("/v1/spaces", json={"name": "x"})
    assert resp.status_code == 422


def test_first_space_becomes_active(client: TestClient, space_repo: FakeSpaceRepo) -> None:
    # A user with no spaces has nowhere to capture, so their first one is
    # adopted as active rather than leaving Save disabled.
    space_repo.spaces.clear()
    space_repo.active.clear()

    created = client.post("/v1/spaces", json={"name": "Claude Code"}).json()
    assert client.get("/v1/session").json()["active_space"]["id"] == created["id"]


def test_later_spaces_do_not_steal_the_active_pointer(client: TestClient) -> None:
    client.post("/v1/spaces", json={"name": "Claude Code"})
    assert client.get("/v1/session").json()["active_space"]["id"] == SEEDED_SPACE_ID


def test_list_spaces_excludes_other_users_spaces(client: TestClient) -> None:
    ids = [s["id"] for s in client.get("/v1/spaces").json()["spaces"]]
    assert SEEDED_SPACE_ID in ids
    assert OTHER_USER_SPACE_ID not in ids


def test_list_space_sources_reflects_a_capture(client: TestClient) -> None:
    client.post(
        "/v1/sources",
        json={
            "space_id": SEEDED_SPACE_ID,
            "type": "article",
            "url": "https://example.com/post",
            "title": "Post",
            "content": "cleaned article text",
        },
    )

    body = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/sources").json()
    assert [s["title"] for s in body["sources"]] == ["Post"]
    assert body["sources"][0]["type"] == "article"
    assert body["sources"][0]["processing_status"] == "queued"

    space = next(
        s for s in client.get("/v1/spaces").json()["spaces"] if s["id"] == SEEDED_SPACE_ID
    )
    assert space["source_counts"]["article"] == 1
    assert space["source_counts"]["total"] == 1


def test_list_space_sources_rejects_an_unowned_space(client: TestClient) -> None:
    resp = client.get(f"/v1/spaces/{OTHER_USER_SPACE_ID}/sources")
    assert resp.status_code == 404


def test_slugify_produces_a_constraint_safe_slug() -> None:
    assert slugify("Claude Code") == "claude-code"
    assert slugify("  C++ & Rust!!  ") == "c-rust"
    assert slugify("System   Design 101") == "system-design-101"
    # Nothing usable to slug — must still satisfy `^[a-z0-9-]+$`.
    assert slugify("日本語") == "space"


def test_colliding_slugs_get_a_numeric_suffix(client: TestClient) -> None:
    # Distinct names that slug identically ("c-rust"); the names differ so the
    # unique-name index is not what's being exercised here.
    first = client.post("/v1/spaces", json={"name": "C++ & Rust"}).json()
    second = client.post("/v1/spaces", json={"name": "C# / Rust"}).json()
    assert first["slug"] == "c-rust"
    assert second["slug"] == "c-rust-2"


def test_delete_space_returns_204_and_drops_from_list(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    resp = client.delete(f"/v1/spaces/{SEEDED_SPACE_ID}")
    assert resp.status_code == 204
    assert SEEDED_SPACE_ID not in space_repo.spaces
    ids = [s["id"] for s in client.get("/v1/spaces").json()["spaces"]]
    assert SEEDED_SPACE_ID not in ids


def test_delete_unowned_space_is_404(client: TestClient) -> None:
    resp = client.delete(f"/v1/spaces/{OTHER_USER_SPACE_ID}")
    assert resp.status_code == 404


def test_delete_unknown_space_is_404(client: TestClient) -> None:
    resp = client.delete("/v1/spaces/00000000-0000-0000-0000-0000000000aa")
    assert resp.status_code == 404


def test_delete_active_space_repoints_to_another(client: TestClient) -> None:
    created = client.post("/v1/spaces", json={"name": "Claude Code"}).json()
    assert client.get("/v1/session").json()["active_space"]["id"] == SEEDED_SPACE_ID

    resp = client.delete(f"/v1/spaces/{SEEDED_SPACE_ID}")
    assert resp.status_code == 204
    assert client.get("/v1/session").json()["active_space"]["id"] == created["id"]


def test_delete_last_space_clears_active(client: TestClient) -> None:
    assert client.get("/v1/session").json()["active_space"]["id"] == SEEDED_SPACE_ID
    resp = client.delete(f"/v1/spaces/{SEEDED_SPACE_ID}")
    assert resp.status_code == 204
    assert client.get("/v1/session").json()["active_space"] is None


def test_delete_space_removes_sources_and_artifacts(
    client: TestClient, storage: FakeStorage, space_repo: FakeSpaceRepo
) -> None:
    source_id = client.post(
        "/v1/sources",
        json={
            "space_id": SEEDED_SPACE_ID,
            "type": "article",
            "url": "https://example.com/post",
            "title": "Post",
            "content": "cleaned article text",
        },
    ).json()["source_id"]
    prefix = space_repo.sources[source_id]["storage_prefix"]
    assert any(path.startswith(prefix) for path in storage.uploads)

    deleted = client.delete(f"/v1/spaces/{SEEDED_SPACE_ID}")
    assert deleted.status_code == 204
    assert source_id not in space_repo.sources
    space_prefix = f"users/{DEV_USER}/spaces/{SEEDED_SPACE_ID}"
    assert not any(
        path == space_prefix or path.startswith(f"{space_prefix}/")
        for path in storage.uploads
    )
