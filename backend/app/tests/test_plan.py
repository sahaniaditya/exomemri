"""Study plan tests: composition of overdue reviews + uncovered topics."""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.schemas.common import User
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeConceptRepo,
    FakeReviewRepo,
    FakeSpaceRepo,
)

DEV_USER_ID = "00000000-0000-0000-0000-0000000000a1"


@pytest.fixture
def dev_user() -> User:
    return User(id=DEV_USER_ID, email="dev@atlas.ai")  # type: ignore[arg-type]


def _seed_source(space_repo: FakeSpaceRepo, *, space_id: str = SEEDED_SPACE_ID) -> dict:
    source_id = str(uuid4())
    row = {
        "id": source_id,
        "space_id": space_id,
        "user_id": DEV_USER_ID,
        "type": "article",
        "title": "A source",
        "url": None,
        "author": None,
        "storage_prefix": f"users/{DEV_USER_ID}/spaces/{space_id}/sources/{source_id}",
        "content_hash": f"hash-{source_id}",
        "processing_status": "ready",
        "captured_at": "2026-08-18T00:00:00+00:00",
        "summary_sections": None,
        "review_items_extracted_at": None,
    }
    space_repo.sources[source_id] = row
    return row


def _seed_review_item(review_repo: FakeReviewRepo, *, source: dict, prompt_text: str) -> dict:
    item_id = str(uuid4())
    row = {
        "id": item_id,
        "source_id": source["id"],
        "space_id": source["space_id"],
        "user_id": source["user_id"],
        "prompt_text": prompt_text,
        "last_reviewed_at": None,
    }
    review_repo.items[item_id] = row
    return row


def _seed_concept(concept_repo: FakeConceptRepo, *, label: str, space_id: str = SEEDED_SPACE_ID):
    slug = label.lower().replace(" ", "-")
    row = {
        "id": str(uuid4()),
        "space_id": space_id,
        "user_id": DEV_USER_ID,
        "label": label,
        "slug": slug,
    }
    concept_repo.concepts[row["id"]] = row
    return row


def test_plan_of_unowned_space_is_not_found(client: TestClient) -> None:
    res = client.get(f"/v1/spaces/{OTHER_USER_SPACE_ID}/plan")
    assert res.status_code == 404


def test_empty_space_returns_an_empty_plan(client: TestClient) -> None:
    res = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/plan")
    assert res.status_code == 200
    assert res.json()["items"] == []


def test_overdue_reviews_are_sequenced_before_uncovered_topics(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    review_repo: FakeReviewRepo,
    concept_repo: FakeConceptRepo,
) -> None:
    source = _seed_source(space_repo)
    _seed_review_item(review_repo, source=source, prompt_text="What is the thing?")
    _seed_concept(concept_repo, label="Load balancing")

    res = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/plan")
    assert res.status_code == 200
    items = res.json()["items"]

    kinds = [i["kind"] for i in items]
    assert kinds[0] == "overdue_review"
    assert items[0]["title"] == "What is the thing?"
    assert items[0]["review_item_id"] is not None
    assert "uncovered_topic" in kinds
    uncovered = next(i for i in items if i["kind"] == "uncovered_topic")
    assert uncovered["review_item_id"] is None


def test_plan_only_review_items_when_space_has_no_concepts(
    client: TestClient, space_repo: FakeSpaceRepo, review_repo: FakeReviewRepo
) -> None:
    source = _seed_source(space_repo)
    _seed_review_item(review_repo, source=source, prompt_text="Only item")

    res = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/plan")
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["kind"] == "overdue_review"
