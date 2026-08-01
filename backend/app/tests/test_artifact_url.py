"""Signed artifact read URLs (GET /v1/sources/{id}/artifact-url).

The `atlas-artifacts` bucket is private, so this endpoint is the only path from
the web app to a captured artifact.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.tests.conftest import SEEDED_SPACE_ID, FakeSpaceRepo, FakeStorage


def _capture_article(client: TestClient) -> str:
    resp = client.post(
        "/v1/sources",
        json={
            "space_id": SEEDED_SPACE_ID,
            "type": "article",
            "url": "https://example.com/post",
            "title": "Post",
            "content": "cleaned article text",
        },
    )
    return resp.json()["source_id"]


def test_artifact_url_signs_a_path_under_the_sources_own_prefix(
    client: TestClient, storage: FakeStorage, space_repo: FakeSpaceRepo
) -> None:
    source_id = _capture_article(client)

    resp = client.get(f"/v1/sources/{source_id}/artifact-url?key=raw/extracted.txt")
    assert resp.status_code == 200
    body = resp.json()
    assert body["expires_in"] == 300
    assert body["url"].startswith("https://test.supabase.co/storage/v1/object/sign/")

    prefix = space_repo.sources[source_id]["storage_prefix"]
    assert storage.read_urls == [(f"{prefix}/raw/extracted.txt", 300)]


def test_artifact_url_defaults_to_meta_json(client: TestClient, storage: FakeStorage) -> None:
    source_id = _capture_article(client)
    assert client.get(f"/v1/sources/{source_id}/artifact-url").status_code == 200
    assert storage.read_urls[0][0].endswith("/raw/meta.json")


def test_artifact_url_rejects_a_traversal_key(
    client: TestClient, storage: FakeStorage
) -> None:
    source_id = _capture_article(client)
    resp = client.get(f"/v1/sources/{source_id}/artifact-url?key=../../../secrets.json")
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation"
    assert storage.read_urls == []


def test_artifact_url_rejects_an_unknown_key(client: TestClient) -> None:
    source_id = _capture_article(client)
    resp = client.get(f"/v1/sources/{source_id}/artifact-url?key=raw/anything.txt")
    assert resp.status_code == 422


def test_artifact_url_404s_for_a_source_the_user_does_not_own(
    client: TestClient, space_repo: FakeSpaceRepo, storage: FakeStorage
) -> None:
    source_id = _capture_article(client)
    space_repo.sources[source_id]["user_id"] = "00000000-0000-0000-0000-0000000000ff"
    storage.read_urls.clear()

    resp = client.get(f"/v1/sources/{source_id}/artifact-url")
    assert resp.status_code == 404
    assert storage.read_urls == []


def test_recent_sources_feed_lists_captures_with_their_space_name(
    client: TestClient,
) -> None:
    _capture_article(client)
    body = client.get("/v1/sources").json()
    assert body["sources"][0]["title"] == "Post"
    assert body["sources"][0]["space_name"] == "System Design"
