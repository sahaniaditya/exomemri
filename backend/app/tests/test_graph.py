"""Knowledge-map tests: graph reads, ownership, and concept canonicalization."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.schemas.common import User
from app.schemas.concepts import ExtractedConcept
from app.schemas.credits import DEFAULT_MONTHLY_ALLOWANCE
from app.services.concept_service import ConceptService
from app.services.coverage_service import CoverageService
from app.services.credits_service import CreditsService
from app.services.extract_service import ExtractService
from app.services.rate_limit_service import NoopRateLimiter
from app.services.space_service import SpaceService
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeCollaboratorRepo,
    FakeConceptRepo,
    FakeCoverageRepo,
    FakeCreditsRepo,
    FakeLLMService,
    FakeSpaceRepo,
    FakeStorage,
)

DEV_USER_ID = "00000000-0000-0000-0000-0000000000a1"


@pytest.fixture
def dev_user() -> User:
    return User(id=DEV_USER_ID, email="dev@exomemri.com")  # type: ignore[arg-type]


def _seed_source(
    space_repo: FakeSpaceRepo,
    storage: FakeStorage,
    *,
    title: str,
    extract_text: str = "some article text",
    space_id: str = SEEDED_SPACE_ID,
    user_id: str = DEV_USER_ID,
) -> dict:
    source_id = str(uuid4())
    prefix = f"users/{user_id}/spaces/{space_id}/sources/{source_id}"
    row = {
        "id": source_id,
        "space_id": space_id,
        "user_id": user_id,
        "type": "article",
        "title": title,
        "url": None,
        "author": None,
        "storage_prefix": prefix,
        "content_hash": f"hash-{source_id}",
        "processing_status": "ready",
        "captured_at": "2026-08-18T00:00:00+00:00",
    }
    space_repo.sources[source_id] = row
    storage.uploads[f"{prefix}/raw/extracted.txt"] = (extract_text.encode("utf-8"), "text/plain")
    return row


def _build_service(
    space_repo: FakeSpaceRepo,
    concept_repo: FakeConceptRepo,
    storage: FakeStorage,
    llm: FakeLLMService,
    *,
    credits_repo: FakeCreditsRepo | None = None,
) -> ConceptService:
    from app.config import get_settings

    space_svc = SpaceService(space_repo, FakeCollaboratorRepo(), storage)  # type: ignore[arg-type]
    credits = CreditsService(credits_repo or FakeCreditsRepo())  # type: ignore[arg-type]
    coverage = CoverageService(
        FakeCoverageRepo(),
        concept_repo,
        space_svc,
        llm,
        NoopRateLimiter(),
        get_settings(),
        credits,  # type: ignore[arg-type]
    )
    return ConceptService(
        concept_repo, space_svc, ExtractService(storage), llm, credits, coverage  # type: ignore[arg-type]
    )


# --- authorization ---


def test_graph_of_unowned_space_is_not_found(client: TestClient) -> None:
    """A space that exists but belongs to someone else reads as 404, not 403,
    so space ids stay unenumerable (same rule as require_owned_space)."""
    res = client.get(f"/v1/spaces/{OTHER_USER_SPACE_ID}/graph")
    assert res.status_code == 404


def test_rebuild_of_unowned_space_is_not_found(client: TestClient) -> None:
    res = client.post(f"/v1/spaces/{OTHER_USER_SPACE_ID}/graph/rebuild")
    assert res.status_code == 404


def test_graph_of_missing_space_is_not_found(client: TestClient) -> None:
    res = client.get(f"/v1/spaces/{uuid4()}/graph")
    assert res.status_code == 404


# --- reads ---


def test_empty_space_returns_an_empty_graph(client: TestClient) -> None:
    res = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/graph")
    assert res.status_code == 200
    assert res.json() == {"concepts": [], "sources": [], "edges": [], "pending": 0}


def test_unmapped_sources_are_reported_as_pending(
    client: TestClient, space_repo: FakeSpaceRepo, storage: FakeStorage
) -> None:
    """A source captured before the map shipped has no concepts_extracted_at, and
    must show up as pending so the UI knows to run a backfill."""
    _seed_source(space_repo, storage, title="Old capture")

    body = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/graph").json()
    assert body["pending"] == 1
    assert len(body["sources"]) == 1
    assert body["concepts"] == []


# --- extraction and canonicalization ---


async def test_extraction_creates_concepts_and_edges(
    dev_user: User,
    space_repo: FakeSpaceRepo,
    concept_repo: FakeConceptRepo,
    storage: FakeStorage,
    llm_service: FakeLLMService,
) -> None:
    source = _seed_source(space_repo, storage, title="Caching")
    svc = _build_service(space_repo, concept_repo, storage, llm_service)

    count = await svc.extract_for_source(source=source, extract="text about caching")

    assert count == 2
    assert sorted(c["label"] for c in concept_repo.concepts.values()) == [
        "Caching basics",
        "Shared subject",
    ]
    assert space_repo.sources[source["id"]]["concepts_extracted_at"] is not None
    assert space_repo.sources[source["id"]]["concepts_model"] == "fake-llm"


async def test_shared_concept_merges_onto_one_node(
    dev_user: User,
    space_repo: FakeSpaceRepo,
    concept_repo: FakeConceptRepo,
    storage: FakeStorage,
    llm_service: FakeLLMService,
) -> None:
    """The whole point of the map (README F4): two sources covering the same
    subject must converge on ONE concept node with two edges, not two nodes."""
    svc = _build_service(space_repo, concept_repo, storage, llm_service)
    first = _seed_source(space_repo, storage, title="Redis")
    second = _seed_source(space_repo, storage, title="Memcached")

    await svc.extract_for_source(source=first, extract="text")
    await svc.extract_for_source(source=second, extract="text")

    shared = [c for c in concept_repo.concepts.values() if c["label"] == "Shared subject"]
    assert len(shared) == 1, "the shared concept forked instead of merging"

    graph = svc.get_graph(dev_user, UUID(SEEDED_SPACE_ID))
    shared_node = next(c for c in graph.concepts if c.label == "Shared subject")
    assert shared_node.degree == 2
    # Ordered strongest-first, so the space's spine leads the list.
    assert graph.concepts[0].degree == 2
    assert len(graph.edges) == 4


async def test_duplicate_labels_in_one_response_collapse_by_slug(
    space_repo: FakeSpaceRepo,
    concept_repo: FakeConceptRepo,
    storage: FakeStorage,
) -> None:
    """One LLM response returning "Load balancing" and "load-balancing" must
    collapse to a single row — upserting both would hit the unique index."""

    class DuplicateLLM(FakeLLMService):
        async def extract_concepts(self, *, title, extract, vocabulary):  # noqa: ANN001, ANN003, ARG002
            return [
                ExtractedConcept(label="Load balancing", weight=0.4),
                ExtractedConcept(label="load-balancing", weight=0.9),
                ExtractedConcept(label="Load Balancing", weight=0.2),
            ]

    source = _seed_source(space_repo, storage, title="LB")
    svc = _build_service(space_repo, concept_repo, storage, DuplicateLLM())

    count = await svc.extract_for_source(source=source, extract="text")

    assert count == 1
    assert len(concept_repo.concepts) == 1
    # Highest weight of the collapsed group wins.
    assert concept_repo.edges[0]["weight"] == 0.9


async def test_unusable_labels_are_skipped(
    space_repo: FakeSpaceRepo,
    concept_repo: FakeConceptRepo,
    storage: FakeStorage,
) -> None:
    """A label with no slug-able characters would slugify to the "space"
    fallback and become a junk node — it must be dropped instead."""

    class EmojiLLM(FakeLLMService):
        async def extract_concepts(self, *, title, extract, vocabulary):  # noqa: ANN001, ANN003, ARG002
            return [ExtractedConcept(label="🎉🎉", weight=1.0)]

    source = _seed_source(space_repo, storage, title="Junk")
    svc = _build_service(space_repo, concept_repo, storage, EmojiLLM())

    count = await svc.extract_for_source(source=source, extract="text")

    assert count == 0
    assert concept_repo.concepts == {}
    # Still marked done, or a backfill loop would retry it forever.
    assert space_repo.sources[source["id"]]["concepts_extracted_at"] is not None


async def test_reextraction_replaces_edges_and_drops_orphans(
    dev_user: User,
    space_repo: FakeSpaceRepo,
    concept_repo: FakeConceptRepo,
    storage: FakeStorage,
    llm_service: FakeLLMService,
) -> None:
    """Re-running extraction must not leave stale edges, and a concept whose only
    source stopped mentioning it must not linger as a degree-0 node."""
    source = _seed_source(space_repo, storage, title="Original")
    svc = _build_service(space_repo, concept_repo, storage, llm_service)
    await svc.extract_for_source(source=source, extract="text")
    assert len(concept_repo.concepts) == 2

    class NarrowLLM(FakeLLMService):
        async def extract_concepts(self, *, title, extract, vocabulary):  # noqa: ANN001, ANN003, ARG002
            return [ExtractedConcept(label="Shared subject", weight=1.0)]

    narrow = _build_service(space_repo, concept_repo, storage, NarrowLLM())
    await narrow.extract_for_source(source=source, extract="text")

    assert len(concept_repo.edges) == 1
    labels = [c["label"] for c in concept_repo.concepts.values()]
    assert labels == ["Shared subject"], "orphaned concept was not cleaned up"


# --- backfill ---


async def test_backfill_maps_pending_sources(
    dev_user: User,
    space_repo: FakeSpaceRepo,
    concept_repo: FakeConceptRepo,
    storage: FakeStorage,
    llm_service: FakeLLMService,
) -> None:
    _seed_source(space_repo, storage, title="One")
    _seed_source(space_repo, storage, title="Two")
    svc = _build_service(space_repo, concept_repo, storage, llm_service)

    result = await svc.backfill(user=dev_user, space_id=UUID(SEEDED_SPACE_ID))

    assert result.processed == 2
    assert result.failed == 0
    assert result.pending == 0


async def test_backfill_is_bounded_per_call(
    dev_user: User,
    space_repo: FakeSpaceRepo,
    concept_repo: FakeConceptRepo,
    storage: FakeStorage,
    llm_service: FakeLLMService,
) -> None:
    """More sources than one batch must leave the rest pending rather than
    running past the request timeout — the client loops."""
    from app.services.concept_service import BACKFILL_BATCH_SIZE

    for i in range(BACKFILL_BATCH_SIZE + 3):
        _seed_source(space_repo, storage, title=f"Source {i}")
    svc = _build_service(space_repo, concept_repo, storage, llm_service)

    result = await svc.backfill(user=dev_user, space_id=UUID(SEEDED_SPACE_ID))

    assert result.processed == BACKFILL_BATCH_SIZE
    assert result.pending == 3


async def test_backfill_survives_a_source_with_no_extract(
    dev_user: User,
    space_repo: FakeSpaceRepo,
    concept_repo: FakeConceptRepo,
    storage: FakeStorage,
    llm_service: FakeLLMService,
) -> None:
    """A PDF with no text-extraction artifact must be counted as failed and
    marked done, so it neither breaks the batch nor loops forever."""
    good = _seed_source(space_repo, storage, title="Readable")
    broken = _seed_source(space_repo, storage, title="Unreadable")
    # Remove the artifact so ExtractService raises for this one only.
    del storage.uploads[f"{broken['storage_prefix']}/raw/extracted.txt"]

    svc = _build_service(space_repo, concept_repo, storage, llm_service)
    result = await svc.backfill(user=dev_user, space_id=UUID(SEEDED_SPACE_ID))

    assert result.processed == 1
    assert result.failed == 1
    assert result.pending == 0
    assert space_repo.sources[broken["id"]]["concepts_extracted_at"] is not None
    assert space_repo.sources[good["id"]]["concepts_extracted_at"] is not None


def test_rebuild_consumes_one_credit_per_non_empty_batch(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    storage: FakeStorage,
    credits_repo: FakeCreditsRepo,
) -> None:
    _seed_source(space_repo, storage, title="Old capture")
    res = client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/graph/rebuild")
    assert res.status_code == 200
    assert res.json()["processed"] == 1
    assert credits_repo.rows[DEV_USER_ID]["balance"] == DEFAULT_MONTHLY_ALLOWANCE - 1


def test_rebuild_empty_batch_is_free(
    client: TestClient, credits_repo: FakeCreditsRepo
) -> None:
    credits_repo.ensure(user_id=DEV_USER_ID)
    before = credits_repo.rows[DEV_USER_ID]["balance"]
    res = client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/graph/rebuild")
    assert res.status_code == 200
    assert res.json() == {"processed": 0, "failed": 0, "pending": 0}
    assert credits_repo.rows[DEV_USER_ID]["balance"] == before


def test_rebuild_returns_402_when_credits_are_exhausted(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    storage: FakeStorage,
    credits_repo: FakeCreditsRepo,
) -> None:
    source = _seed_source(space_repo, storage, title="Old capture")
    credits_repo.ensure(user_id=DEV_USER_ID)
    credits_repo.rows[DEV_USER_ID]["balance"] = 0

    res = client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/graph/rebuild")
    assert res.status_code == 402
    assert res.json()["error"]["code"] == "credits_exhausted"
    assert space_repo.sources[source["id"]].get("concepts_extracted_at") is None
