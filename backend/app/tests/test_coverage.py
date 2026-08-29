"""Coverage-per-space tests: cache-only GET, metered POST, ownership."""

from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from app.errors import StorageError
from app.schemas.coverage import SyllabusTopic
from app.schemas.credits import DEFAULT_MONTHLY_ALLOWANCE
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeConceptRepo,
    FakeCoverageRepo,
    FakeCreditsRepo,
    FakeLLMService,
)

DEV_USER_ID = "00000000-0000-0000-0000-0000000000a1"


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


def test_get_coverage_with_concepts_does_not_generate(
    client: TestClient,
    concept_repo: FakeConceptRepo,
    coverage_repo: FakeCoverageRepo,
    credits_repo: FakeCreditsRepo,
) -> None:
    _seed_concept(concept_repo, label="Load balancing")
    _seed_concept(concept_repo, label="Consistent hashing")
    credits_repo.ensure(user_id=DEV_USER_ID)
    before = credits_repo.rows[DEV_USER_ID]["balance"]

    res = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/coverage")
    assert res.status_code == 200
    assert res.json()["coverage_pct"] is None
    assert SEEDED_SPACE_ID not in coverage_repo.coverage
    assert credits_repo.rows[DEV_USER_ID]["balance"] == before


def test_post_coverage_generates_and_consumes_credit(
    client: TestClient,
    concept_repo: FakeConceptRepo,
    coverage_repo: FakeCoverageRepo,
    credits_repo: FakeCreditsRepo,
) -> None:
    _seed_concept(concept_repo, label="Load balancing")
    _seed_concept(concept_repo, label="Consistent hashing")

    first = client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/coverage")
    assert first.status_code == 200
    body = first.json()
    # FakeLLMService marks every captured concept covered, plus 2 gaps: 2/4 = 50%.
    assert body["coverage_pct"] == 50
    assert len(body["topics"]) == 4
    assert coverage_repo.coverage[SEEDED_SPACE_ID]["syllabus_concept_count"] == 2
    assert credits_repo.rows[DEV_USER_ID]["balance"] == DEFAULT_MONTHLY_ALLOWANCE - 1

    second = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/coverage")
    assert second.status_code == 200
    assert second.json() == body
    assert credits_repo.rows[DEV_USER_ID]["balance"] == DEFAULT_MONTHLY_ALLOWANCE - 1


def test_get_coverage_returns_stale_cache_when_concepts_change(
    client: TestClient, concept_repo: FakeConceptRepo
) -> None:
    _seed_concept(concept_repo, label="Load balancing")
    first = client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/coverage")
    assert first.json()["coverage_pct"] == 33  # 1 covered / 3 topics, rounded

    _seed_concept(concept_repo, label="Consistent hashing")
    stale = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/coverage")
    assert stale.json()["coverage_pct"] == 33

    refreshed = client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/coverage")
    assert refreshed.json()["coverage_pct"] == 50
    assert len(refreshed.json()["topics"]) == 4


def test_coverage_pct_surfaces_on_the_space_list(
    client: TestClient, concept_repo: FakeConceptRepo
) -> None:
    listed_before = client.get("/v1/spaces").json()["spaces"]
    seeded_before = next(s for s in listed_before if s["id"] == SEEDED_SPACE_ID)
    assert seeded_before["coverage_pct"] is None

    _seed_concept(concept_repo, label="Load balancing")
    _seed_concept(concept_repo, label="Consistent hashing")
    client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/coverage")

    listed_after = client.get("/v1/spaces").json()["spaces"]
    seeded_after = next(s for s in listed_after if s["id"] == SEEDED_SPACE_ID)
    assert seeded_after["coverage_pct"] == 50


def test_post_coverage_returns_402_when_credits_are_exhausted(
    client: TestClient,
    concept_repo: FakeConceptRepo,
    coverage_repo: FakeCoverageRepo,
    credits_repo: FakeCreditsRepo,
) -> None:
    _seed_concept(concept_repo, label="Load balancing")
    credits_repo.ensure(user_id=DEV_USER_ID)
    credits_repo.rows[DEV_USER_ID]["balance"] = 0

    res = client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/coverage")
    assert res.status_code == 402
    assert res.json()["error"]["code"] == "credits_exhausted"
    assert SEEDED_SPACE_ID not in coverage_repo.coverage


def test_post_coverage_refunds_on_llm_failure(
    client: TestClient,
    concept_repo: FakeConceptRepo,
    coverage_repo: FakeCoverageRepo,
    credits_repo: FakeCreditsRepo,
    llm_service: FakeLLMService,
) -> None:
    _seed_concept(concept_repo, label="Load balancing")
    credits_repo.ensure(user_id=DEV_USER_ID)
    before = credits_repo.rows[DEV_USER_ID]["balance"]

    async def boom(
        *, space_name: str, goal_text: str | None, concept_labels: list[str]  # noqa: ARG002
    ) -> list[SyllabusTopic]:
        raise StorageError("haiku down")

    llm_service.infer_syllabus_coverage = boom  # type: ignore[method-assign]

    res = client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/coverage")
    assert res.status_code == 502
    assert SEEDED_SPACE_ID not in coverage_repo.coverage
    assert credits_repo.rows[DEV_USER_ID]["balance"] == before
