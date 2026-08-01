"""Capture endpoint tests (POST /v1/sources)."""

from __future__ import annotations

import hashlib
import json

from fastapi.testclient import TestClient

from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeSpaceRepo,
    FakeStorage,
)

DEV_USER = "00000000-0000-0000-0000-0000000000a1"
SPACE = SEEDED_SPACE_ID


def _key(source_id: str, leaf: str) -> str:
    return f"users/{DEV_USER}/spaces/{SPACE}/sources/{source_id}/{leaf}"


def test_capture_youtube_writes_transcript_and_meta(
    client: TestClient, storage: FakeStorage
) -> None:
    content = json.dumps({"segments": [{"start": 0, "text": "hi"}]})
    resp = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "youtube",
            "url": "https://www.youtube.com/watch?v=abc",
            "title": "A talk",
            "author": "Some Channel",
            "content": content,
        },
    )
    assert resp.status_code == 202
    body = resp.json()
    assert body["processing_status"] == "queued"
    source_id = body["source_id"]

    assert _key(source_id, "raw/transcript.json") in storage.uploads
    assert _key(source_id, "raw/meta.json") in storage.uploads

    meta_bytes, meta_ct = storage.uploads[_key(source_id, "raw/meta.json")]
    assert meta_ct == "application/json"
    meta = json.loads(meta_bytes)
    assert meta["type"] == "youtube"
    assert meta["content_hash"] == hashlib.sha256(content.encode()).hexdigest()


def test_capture_article_writes_page_html_and_extracted(
    client: TestClient, storage: FakeStorage
) -> None:
    resp = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "article",
            "url": "https://example.com/post",
            "title": "Post",
            "content": "cleaned article text",
            "raw_html": "<html><body>raw</body></html>",
        },
    )
    assert resp.status_code == 202
    source_id = resp.json()["source_id"]

    assert _key(source_id, "raw/page.html") in storage.uploads
    assert _key(source_id, "raw/extracted.txt") in storage.uploads
    text_bytes, text_ct = storage.uploads[_key(source_id, "raw/extracted.txt")]
    assert text_bytes.decode() == "cleaned article text"
    assert text_ct.startswith("text/plain")


def test_capture_ai_chat_writes_chat_json(client: TestClient, storage: FakeStorage) -> None:
    resp = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "ai_chat",
            "url": "https://chatgpt.com/c/xyz",
            "title": "Chat",
            "content": json.dumps([{"role": "user", "text": "hello"}]),
        },
    )
    assert resp.status_code == 202
    source_id = resp.json()["source_id"]
    assert _key(source_id, "raw/chat.json") in storage.uploads


def test_capture_pdf_via_sources_is_rejected(client: TestClient) -> None:
    resp = client.post(
        "/v1/sources",
        json={"space_id": SPACE, "type": "pdf", "title": "doc.pdf"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation"


def test_capture_rejects_missing_title(client: TestClient) -> None:
    resp = client.post(
        "/v1/sources",
        json={"space_id": SPACE, "type": "article", "content": "x"},
    )
    assert resp.status_code == 422


def test_capture_records_a_source_row(
    client: TestClient, storage: FakeStorage, space_repo: FakeSpaceRepo
) -> None:
    resp = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "article",
            "url": "https://example.com/post",
            "title": "Post",
            "content": "cleaned article text",
        },
    )
    source_id = resp.json()["source_id"]

    row = space_repo.sources[source_id]
    assert row["space_id"] == SPACE
    assert row["user_id"] == DEV_USER
    assert row["type"] == "article"
    assert row["processing_status"] == "queued"
    # The prefix embeds the row id, so the artifacts are reachable from the row.
    assert row["storage_prefix"] == f"users/{DEV_USER}/spaces/{SPACE}/sources/{source_id}"
    assert _key(source_id, "raw/extracted.txt") in storage.uploads


def test_capture_into_an_unowned_space_writes_nothing(
    client: TestClient, storage: FakeStorage, space_repo: FakeSpaceRepo
) -> None:
    resp = client.post(
        "/v1/sources",
        json={
            "space_id": OTHER_USER_SPACE_ID,
            "type": "article",
            "url": "https://example.com/post",
            "title": "Post",
            "content": "text",
        },
    )
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"
    # Authorization happens before any write, so neither storage nor Postgres
    # was touched.
    assert storage.uploads == {}
    assert space_repo.sources == {}


def test_recapturing_the_same_page_updates_one_row(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    payload = {
        "space_id": SPACE,
        "type": "article",
        "url": "https://example.com/post",
        "title": "Post",
        "content": "cleaned article text",
    }
    first = client.post("/v1/sources", json=payload).json()["source_id"]
    second = client.post("/v1/sources", json={**payload, "title": "Post (v2)"}).json()[
        "source_id"
    ]

    assert second == first
    assert len(space_repo.sources) == 1
    assert space_repo.sources[first]["title"] == "Post (v2)"
