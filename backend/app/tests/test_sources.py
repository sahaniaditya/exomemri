"""Capture endpoint tests (POST /v1/sources, DELETE /v1/sources/{id})."""

from __future__ import annotations

import hashlib
import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError as PydanticValidationError

from app.schemas.sources import (
    MAX_CAPTURE_CONTENT_CHARS,
    MAX_CAPTURE_RAW_HTML_CHARS,
    CaptureRequest,
)
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeConceptRepo,
    FakeCreditsRepo,
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


def test_capture_rejects_oversized_content(
    client: TestClient, storage: FakeStorage
) -> None:
    resp = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "article",
            "url": "https://example.com/post",
            "title": "Post",
            "content": "x" * (MAX_CAPTURE_CONTENT_CHARS + 1),
        },
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation"
    assert storage.uploads == {}


def test_capture_request_rejects_oversized_raw_html() -> None:
    with pytest.raises(PydanticValidationError) as exc_info:
        CaptureRequest.model_validate(
            {
                "space_id": SPACE,
                "type": "article",
                "title": "Post",
                "raw_html": "x" * (MAX_CAPTURE_RAW_HTML_CHARS + 1),
            }
        )
    assert any(err["type"] == "string_too_long" for err in exc_info.value.errors())


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


def test_recapturing_same_article_url_with_new_body_updates_one_row(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    first = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "article",
            "url": "https://example.com/post?utm_source=share",
            "title": "Post",
            "content": "first extract",
        },
    ).json()["source_id"]
    second = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "article",
            "url": "https://example.com/post",
            "title": "Post (updated)",
            "content": "second extract with more text",
        },
    ).json()["source_id"]

    assert second == first
    assert len(space_repo.sources) == 1
    row = space_repo.sources[first]
    assert row["title"] == "Post (updated)"
    assert row["url"] == "https://example.com/post"
    assert row["content_hash"] == hashlib.sha256(
        b"second extract with more text"
    ).hexdigest()


def test_recapturing_same_chat_thread_with_new_messages_updates_one_row(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    first_content = json.dumps(
        {"title": "Chat", "url": "https://chatgpt.com/c/xyz", "messages": [
            {"role": "user", "text": "hello"}
        ]}
    )
    second_content = json.dumps(
        {"title": "Chat", "url": "https://chatgpt.com/c/xyz", "messages": [
            {"role": "user", "text": "hello"},
            {"role": "assistant", "text": "hi there"},
        ]}
    )
    first = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "ai_chat",
            "url": "https://chatgpt.com/c/xyz",
            "title": "Chat",
            "content": first_content,
        },
    ).json()["source_id"]
    second = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "ai_chat",
            "url": "https://chatgpt.com/c/xyz",
            "title": "Chat",
            "content": second_content,
        },
    ).json()["source_id"]

    assert second == first
    assert len(space_repo.sources) == 1
    assert space_repo.sources[first]["content_hash"] == hashlib.sha256(
        second_content.encode()
    ).hexdigest()


def test_recapturing_chatgpt_host_variant_reuses_the_thread(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    first = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "ai_chat",
            "url": "https://chatgpt.com/c/thread-1",
            "title": "Chat",
            "content": json.dumps([{"role": "user", "text": "one"}]),
        },
    ).json()["source_id"]
    second = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "ai_chat",
            "url": "https://chat.openai.com/c/thread-1",
            "title": "Chat",
            "content": json.dumps(
                [{"role": "user", "text": "one"}, {"role": "user", "text": "two"}]
            ),
        },
    ).json()["source_id"]

    assert second == first
    assert len(space_repo.sources) == 1
    assert space_repo.sources[first]["url"] == "https://chatgpt.com/c/thread-1"


def test_different_article_urls_create_two_rows(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    first = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "article",
            "url": "https://example.com/a",
            "title": "A",
            "content": "aaa",
        },
    ).json()["source_id"]
    second = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "article",
            "url": "https://example.com/b",
            "title": "B",
            "content": "bbb",
        },
    ).json()["source_id"]

    assert first != second
    assert len(space_repo.sources) == 2


def test_same_url_in_a_different_space_is_a_new_capture(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    other_space = client.post("/v1/spaces", json={"name": "Second space"}).json()["id"]
    payload = {
        "type": "article",
        "url": "https://example.com/shared",
        "title": "Shared",
        "content": "same body",
    }
    first = client.post("/v1/sources", json={**payload, "space_id": SPACE}).json()[
        "source_id"
    ]
    second = client.post(
        "/v1/sources", json={**payload, "space_id": other_space}
    ).json()["source_id"]

    assert first != second
    assert len(space_repo.sources) == 2


def test_chatgpt_homepage_without_thread_id_does_not_collapse_chats(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    first = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "ai_chat",
            "url": "https://chatgpt.com/",
            "title": "New chat",
            "content": json.dumps([{"role": "user", "text": "alpha"}]),
        },
    ).json()["source_id"]
    second = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "ai_chat",
            "url": "https://chatgpt.com/",
            "title": "New chat",
            "content": json.dumps([{"role": "user", "text": "beta"}]),
        },
    ).json()["source_id"]

    assert first != second
    assert len(space_repo.sources) == 2


def test_delete_capture_removes_row_and_artifacts(
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
    prefix = space_repo.sources[source_id]["storage_prefix"]
    assert any(path.startswith(prefix) for path in storage.uploads)

    deleted = client.delete(f"/v1/sources/{source_id}")
    assert deleted.status_code == 204
    assert source_id not in space_repo.sources
    assert not any(
        path == prefix or path.startswith(f"{prefix}/") for path in storage.uploads
    )


def test_delete_unknown_capture_is_404(client: TestClient) -> None:
    resp = client.delete("/v1/sources/00000000-0000-0000-0000-0000000000aa")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"


def test_delete_unowned_capture_is_404(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    other_id = "00000000-0000-0000-0000-0000000000bb"
    space_repo.sources[other_id] = {
        "id": other_id,
        "space_id": OTHER_USER_SPACE_ID,
        "user_id": "00000000-0000-0000-0000-0000000000ff",
        "type": "article",
        "title": "Not yours",
        "url": None,
        "author": None,
        "storage_prefix": (
            f"users/00000000-0000-0000-0000-0000000000ff/spaces/"
            f"{OTHER_USER_SPACE_ID}/sources/{other_id}"
        ),
        "content_hash": "hash-not-yours",
        "processing_status": "ready",
        "captured_at": "2026-08-18T00:00:00+00:00",
    }
    resp = client.delete(f"/v1/sources/{other_id}")
    assert resp.status_code == 404
    assert other_id in space_repo.sources


def test_delete_capture_prunes_orphan_concepts(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    concept_repo: FakeConceptRepo,
) -> None:
    source_id = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "article",
            "url": "https://example.com/concepts",
            "title": "Concepts",
            "content": "cleaned article text",
        },
    ).json()["source_id"]
    created = concept_repo.upsert_concepts(
        [
            {
                "space_id": SPACE,
                "user_id": DEV_USER,
                "label": "Load balancer",
                "slug": "load-balancer",
            }
        ]
    )[0]
    concept_repo.replace_source_concepts(
        source_id=source_id,
        edges=[
            {
                "source_id": source_id,
                "concept_id": created["id"],
                "space_id": SPACE,
                "user_id": DEV_USER,
                "weight": 1.0,
            }
        ],
    )

    resp = client.delete(f"/v1/sources/{source_id}")
    assert resp.status_code == 204
    assert source_id not in space_repo.sources
    assert created["id"] not in concept_repo.concepts
    assert concept_repo.edges == []


def test_capture_returns_402_when_out_of_credits(
    client: TestClient, credits_repo: FakeCreditsRepo, storage: FakeStorage
) -> None:
    credits_repo.ensure(user_id=DEV_USER)
    credits_repo.rows[DEV_USER]["balance"] = 0
    resp = client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "article",
            "url": "https://example.com/blocked",
            "title": "Blocked",
            "content": "nope",
        },
    )
    assert resp.status_code == 402
    assert resp.json()["error"]["code"] == "credits_exhausted"
    assert storage.uploads == {}
