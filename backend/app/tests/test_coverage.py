"""Coverage-per-space tests: lazy generation, caching, staleness, ownership."""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.schemas.common import User
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeConceptRepo,
    FakeCoverageRepo,
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


def test_coverage_of_unowned_space_is_not_found(client: TestClient) -> None:
    res = client.get(f"/v1/spaces/{OTHER_USER_SPACE_ID}/coverage")
    assert res.status_code == 404


def test_empty_space_reports_not_assessed(client: TestClient) -> None:
    res = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/coverage")
    assert res.status_code == 200
    body = res.json()
    assert body["coverage_pct"] is None
    assert body["topics"] == []


def test_space_with_concepts_generates_and_caches_coverage(
    client: TestClient, concept_repo: FakeConceptRepo, coverage_repo: FakeCoverageRepo
) -> None:
    _seed_concept(concept_repo, label="Load balancing")
    _seed_concept(concept_repo, label="Consistent hashing")

    first = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/coverage")
    assert first.status_code == 200
    body = first.json()
    # FakeLLMService marks every captured concept covered, plus 2 gaps: 2/4 = 50%.
    assert body["coverage_pct"] == 50
    assert len(body["topics"]) == 4
    assert coverage_repo.coverage[SEEDED_SPACE_ID]["syllabus_concept_count"] == 2

    second = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/coverage")
    assert second.status_code == 200
    assert second.json() == body


def test_coverage_regenerates_when_concept_count_changes(
    client: TestClient, concept_repo: FakeConceptRepo
) -> None:
    _seed_concept(concept_repo, label="Load balancing")
    first = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/coverage")
    assert first.json()["coverage_pct"] == 33  # 1 covered / 3 topics, rounded

    _seed_concept(concept_repo, label="Consistent hashing")
    second = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/coverage")
    assert second.json()["coverage_pct"] == 50  # 2 covered / 4 topics
    assert len(second.json()["topics"]) == 4


def test_coverage_pct_surfaces_on_the_space_list(
    client: TestClient, concept_repo: FakeConceptRepo
) -> None:
    listed_before = client.get("/v1/spaces").json()["spaces"]
    seeded_before = next(s for s in listed_before if s["id"] == SEEDED_SPACE_ID)
    assert seeded_before["coverage_pct"] is None

    _seed_concept(concept_repo, label="Load balancing")
    _seed_concept(concept_repo, label="Consistent hashing")
    client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/coverage")  # triggers generation

    listed_after = client.get("/v1/spaces").json()["spaces"]
    seeded_after = next(s for s in listed_after if s["id"] == SEEDED_SPACE_ID)
    assert seeded_after["coverage_pct"] == 50
