"""Study plan tests: composition of uncovered coverage topics."""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.schemas.common import User
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    SEEDED_SPACE_NAME,
    FakeConceptRepo,
)

DEV_USER_ID = "00000000-0000-0000-0000-0000000000a1"


@pytest.fixture
def dev_user() -> User:
    return User(id=DEV_USER_ID, email="dev@exomemri.com")  # type: ignore[arg-type]


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


def test_uncovered_topics_make_up_the_plan(
    client: TestClient, concept_repo: FakeConceptRepo
) -> None:
    _seed_concept(concept_repo, label="Load balancing")

    res = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/plan")
    assert res.status_code == 200
    items = res.json()["items"]

    assert items
    assert all(i["kind"] == "uncovered_topic" for i in items)
    titles = {i["title"] for i in items}
    assert f"{SEEDED_SPACE_NAME} gap A" in titles
    assert "Load balancing" not in titles
