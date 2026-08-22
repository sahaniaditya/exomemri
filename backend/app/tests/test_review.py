"""Daily review queue tests: staleness filtering, ownership, and backfill."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.schemas.common import User
from app.tests.conftest import OTHER_USER_SPACE_ID, SEEDED_SPACE_ID, FakeReviewRepo, FakeSpaceRepo

DEV_USER_ID = "00000000-0000-0000-0000-0000000000a1"


@pytest.fixture
def dev_user() -> User:
    return User(id=DEV_USER_ID, email="dev@atlas.ai")  # type: ignore[arg-type]


def _seed_source(
    space_repo: FakeSpaceRepo,
    *,
    title: str = "A source",
    space_id: str = SEEDED_SPACE_ID,
    user_id: str = DEV_USER_ID,
) -> dict:
    source_id = str(uuid4())
    row = {
        "id": source_id,
        "space_id": space_id,
        "user_id": user_id,
        "type": "article",
        "title": title,
        "url": None,
        "author": None,
        "storage_prefix": f"users/{user_id}/spaces/{space_id}/sources/{source_id}",
        "content_hash": f"hash-{source_id}",
        "processing_status": "ready",
        "captured_at": "2026-08-18T00:00:00+00:00",
        "summary_sections": None,
        "review_items_extracted_at": None,
    }
    space_repo.sources[source_id] = row
    return row


def _seed_item(
    review_repo: FakeReviewRepo,
    *,
    source: dict,
    prompt_text: str = "Explain the thing",
    last_reviewed_at: str | None = None,
) -> dict:
    item_id = str(uuid4())
    row = {
        "id": item_id,
        "source_id": source["id"],
        "space_id": source["space_id"],
        "user_id": source["user_id"],
        "prompt_text": prompt_text,
        "last_reviewed_at": last_reviewed_at,
    }
    review_repo.items[item_id] = row
    return row


# --- authorization ---


def test_today_queue_of_unowned_space_is_not_found(client: TestClient) -> None:
    res = client.get(f"/v1/spaces/{OTHER_USER_SPACE_ID}/review/today")
    assert res.status_code == 404


def test_rebuild_of_unowned_space_is_not_found(client: TestClient) -> None:
    res = client.post(f"/v1/spaces/{OTHER_USER_SPACE_ID}/review/rebuild")
    assert res.status_code == 404


def test_mark_reviewed_of_unowned_space_is_not_found(client: TestClient) -> None:
    res = client.post(f"/v1/spaces/{OTHER_USER_SPACE_ID}/review/{uuid4()}/reviewed")
    assert res.status_code == 404


# --- queue construction ---


def test_empty_space_returns_an_empty_queue(client: TestClient) -> None:
    res = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/review/today")
    assert res.status_code == 200
    assert res.json() == {"items": [], "total_pending": 0}


def test_never_reviewed_items_sort_first(
    client: TestClient, space_repo: FakeSpaceRepo, review_repo: FakeReviewRepo
) -> None:
    source = _seed_source(space_repo)
    stale = _seed_item(
        review_repo,
        source=source,
        prompt_text="Reviewed long ago",
        last_reviewed_at=(datetime.now(UTC) - timedelta(days=10)).isoformat(),
    )
    never = _seed_item(review_repo, source=source, prompt_text="Never reviewed")

    res = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/review/today")
    assert res.status_code == 200
    items = res.json()["items"]
    assert [i["id"] for i in items] == [never["id"], stale["id"]]
    assert items[0]["source_title"] == source["title"]


def test_recently_reviewed_items_are_excluded(
    client: TestClient, space_repo: FakeSpaceRepo, review_repo: FakeReviewRepo
) -> None:
    source = _seed_source(space_repo)
    _seed_item(
        review_repo,
        source=source,
        last_reviewed_at=datetime.now(UTC).isoformat(),
    )

    res = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/review/today")
    assert res.status_code == 200
    assert res.json() == {"items": [], "total_pending": 0}


def test_queue_is_capped_and_reports_remaining(
    client: TestClient, space_repo: FakeSpaceRepo, review_repo: FakeReviewRepo
) -> None:
    source = _seed_source(space_repo)
    for i in range(25):
        _seed_item(review_repo, source=source, prompt_text=f"Item {i}")

    res = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/review/today")
    assert res.status_code == 200
    body = res.json()
    assert len(body["items"]) == 20
    assert body["total_pending"] == 5


# --- mark reviewed ---


def test_mark_reviewed_updates_timestamp_and_leaves_the_queue(
    client: TestClient, space_repo: FakeSpaceRepo, review_repo: FakeReviewRepo
) -> None:
    source = _seed_source(space_repo)
    item = _seed_item(review_repo, source=source)

    res = client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/review/{item['id']}/reviewed")
    assert res.status_code == 200
    assert res.json()["last_reviewed_at"] is not None

    queue = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/review/today")
    assert queue.json() == {"items": [], "total_pending": 0}


def test_mark_reviewed_of_missing_item_is_not_found(client: TestClient) -> None:
    res = client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/review/{uuid4()}/reviewed")
    assert res.status_code == 404


# --- backfill ---


def test_rebuild_generates_items_for_summarized_sources(
    client: TestClient, space_repo: FakeSpaceRepo, review_repo: FakeReviewRepo
) -> None:
    source = _seed_source(space_repo)
    space_repo.sources[source["id"]]["summary_sections"] = {
        "tldr": [f"point {i}" for i in range(5)],
        "key_concepts": ["a concept"],
        "examples": ["an example"],
        "interview_points": ["What is the thing?", "Why does it matter?"],
    }

    res = client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/review/rebuild")
    assert res.status_code == 200
    body = res.json()
    assert body == {"processed": 1, "failed": 0, "pending": 0}

    items = [r for r in review_repo.items.values() if r["source_id"] == source["id"]]
    assert {i["prompt_text"] for i in items} == {"What is the thing?", "Why does it matter?"}
    assert space_repo.sources[source["id"]]["review_items_extracted_at"] is not None


def test_rebuild_leaves_unsummarized_sources_pending(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    _seed_source(space_repo)  # no summary_sections yet

    res = client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/review/rebuild")
    assert res.status_code == 200
    body = res.json()
    assert body["processed"] == 0
    assert body["pending"] == 1
