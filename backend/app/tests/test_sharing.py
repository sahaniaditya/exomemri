"""Read-only sharing tests: invite/revoke via HTTP, and cross-user viewer
access exercised by constructing services directly (the hermetic ``client``
fixture always authenticates as one fixed dev user, so a second user's
viewpoint has to be built by hand, same as ``test_graph.py``'s pattern)."""

from __future__ import annotations

import asyncio
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.errors import NotFoundError
from app.schemas.common import User
from app.services.concept_service import ConceptService
from app.services.extract_service import ExtractService
from app.services.sharing_service import SharingService
from app.services.source_chat_service import SourceChatService
from app.services.space_service import SpaceService
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeCollaboratorRepo,
    FakeConceptRepo,
    FakeLLMService,
    FakeProfileRepo,
    FakeSpaceRepo,
    FakeStorage,
)

DEV_USER_ID = "00000000-0000-0000-0000-0000000000a1"
OTHER_USER_ID = "00000000-0000-0000-0000-0000000000ff"


@pytest.fixture
def dev_user() -> User:
    return User(id=DEV_USER_ID, email="dev@atlas.ai")  # type: ignore[arg-type]


@pytest.fixture
def other_user() -> User:
    return User(id=OTHER_USER_ID, email="other@atlas.ai")  # type: ignore[arg-type]


def _seed_source(space_repo: FakeSpaceRepo, *, space_id: str, user_id: str) -> dict:
    source_id = str(uuid4())
    row = {
        "id": source_id,
        "space_id": space_id,
        "user_id": user_id,
        "type": "note",
        "title": "A note",
        "url": None,
        "author": None,
        "storage_prefix": f"users/{user_id}/spaces/{space_id}/sources/{source_id}",
        "content_hash": f"hash-{source_id}",
        "processing_status": "ready",
        "captured_at": "2026-08-18T00:00:00+00:00",
        "summary_text": "A summary",
        "summary_sections": {
            "tldr": [f"point {i}" for i in range(5)],
            "key_concepts": ["a concept"],
            "examples": ["an example"],
            "interview_points": ["a question"],
        },
        "summary_model": "fake-llm",
        "summarized_at": "2026-08-18T00:00:00+00:00",
    }
    space_repo.sources[source_id] = row
    return row


def _build_services(
    space_repo: FakeSpaceRepo,
    collaborator_repo: FakeCollaboratorRepo,
    profile_repo: FakeProfileRepo,
) -> tuple[SpaceService, SharingService]:
    space_svc = SpaceService(space_repo, collaborator_repo)  # type: ignore[arg-type]
    sharing_svc = SharingService(
        collaborator_repo, space_svc, profile_repo  # type: ignore[arg-type]
    )
    return space_svc, sharing_svc


# --- owner-side HTTP: invite/list/revoke ---


def test_invite_unknown_username_is_not_found(client: TestClient) -> None:
    res = client.post(
        f"/v1/spaces/{SEEDED_SPACE_ID}/collaborators", json={"username": "nobody"}
    )
    assert res.status_code == 404


def test_invite_into_unowned_space_is_not_found(
    client: TestClient, profile_repo: FakeProfileRepo
) -> None:
    profile_repo.profiles[OTHER_USER_ID] = {"id": OTHER_USER_ID, "username": "friend"}
    res = client.post(
        f"/v1/spaces/{OTHER_USER_SPACE_ID}/collaborators", json={"username": "friend"}
    )
    assert res.status_code == 404


def test_invite_grants_and_lists_a_collaborator(
    client: TestClient, profile_repo: FakeProfileRepo
) -> None:
    profile_repo.profiles[OTHER_USER_ID] = {
        "id": OTHER_USER_ID,
        "username": "friend",
        "full_name": "A Friend",
    }

    invite = client.post(
        f"/v1/spaces/{SEEDED_SPACE_ID}/collaborators", json={"username": "friend"}
    )
    assert invite.status_code == 201
    assert invite.json()["username"] == "friend"

    listed = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/collaborators")
    assert listed.status_code == 200
    assert [c["username"] for c in listed.json()["collaborators"]] == ["friend"]


def test_inviting_the_same_person_twice_is_a_no_op(
    client: TestClient, profile_repo: FakeProfileRepo
) -> None:
    profile_repo.profiles[OTHER_USER_ID] = {"id": OTHER_USER_ID, "username": "friend"}
    client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/collaborators", json={"username": "friend"})
    second = client.post(
        f"/v1/spaces/{SEEDED_SPACE_ID}/collaborators", json={"username": "friend"}
    )
    assert second.status_code == 201

    listed = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/collaborators")
    assert len(listed.json()["collaborators"]) == 1


def test_revoke_removes_the_collaborator(
    client: TestClient, profile_repo: FakeProfileRepo
) -> None:
    profile_repo.profiles[OTHER_USER_ID] = {"id": OTHER_USER_ID, "username": "friend"}
    client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/collaborators", json={"username": "friend"})

    revoke = client.delete(f"/v1/spaces/{SEEDED_SPACE_ID}/collaborators/{OTHER_USER_ID}")
    assert revoke.status_code == 204

    listed = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/collaborators")
    assert listed.json()["collaborators"] == []


def test_cannot_invite_yourself(client: TestClient) -> None:
    res = client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/collaborators", json={"username": "dev"})
    assert res.status_code == 422


def test_shared_with_me_lists_a_space_granted_to_the_caller(
    client: TestClient, collaborator_repo: FakeCollaboratorRepo
) -> None:
    collaborator_repo.add(
        space_id=OTHER_USER_SPACE_ID, user_id=DEV_USER_ID, invited_by=OTHER_USER_ID
    )
    res = client.get("/v1/shared-with-me")
    assert res.status_code == 200
    spaces = res.json()["spaces"]
    assert [s["id"] for s in spaces] == [OTHER_USER_SPACE_ID]


# --- viewer-side authorization, built by hand for a second user's viewpoint ---


def test_collaborator_can_list_sources_and_read_summaries(
    dev_user: User,
    other_user: User,
    space_repo: FakeSpaceRepo,
    collaborator_repo: FakeCollaboratorRepo,
    profile_repo: FakeProfileRepo,
    storage: FakeStorage,
    llm_service: FakeLLMService,
) -> None:
    space_svc, sharing_svc = _build_services(space_repo, collaborator_repo, profile_repo)
    source = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    profile_repo.profiles[OTHER_USER_ID] = {"id": OTHER_USER_ID, "username": "friend"}
    sharing_svc.invite(dev_user, UUID(SEEDED_SPACE_ID), "friend")

    # The collaborator can now list this space's sources...
    sources = space_svc.list_sources(other_user, space_id=UUID(SEEDED_SPACE_ID))
    assert [s.id for s in sources] == [UUID(source["id"])]

    # ...and read the source's cached summary, without owning it.
    extracts = ExtractService(storage)  # type: ignore[arg-type]
    chat_svc = SourceChatService(
        space_svc, extracts, llm_service, None, None  # type: ignore[arg-type]
    )
    summary = asyncio.run(
        chat_svc.get_or_create_summary(user=other_user, source_id=UUID(source["id"]))
    )
    assert summary.summary == "A summary"


def test_collaborator_cannot_view_an_unshared_space(
    other_user: User,
    space_repo: FakeSpaceRepo,
    collaborator_repo: FakeCollaboratorRepo,
    profile_repo: FakeProfileRepo,
) -> None:
    space_svc, _ = _build_services(space_repo, collaborator_repo, profile_repo)
    with pytest.raises(NotFoundError):
        space_svc.list_sources(other_user, space_id=UUID(SEEDED_SPACE_ID))


def test_revoked_collaborator_loses_view_access(
    dev_user: User,
    other_user: User,
    space_repo: FakeSpaceRepo,
    collaborator_repo: FakeCollaboratorRepo,
    profile_repo: FakeProfileRepo,
) -> None:
    space_svc, sharing_svc = _build_services(space_repo, collaborator_repo, profile_repo)
    profile_repo.profiles[OTHER_USER_ID] = {"id": OTHER_USER_ID, "username": "friend"}
    sharing_svc.invite(dev_user, UUID(SEEDED_SPACE_ID), "friend")
    sharing_svc.revoke(dev_user, UUID(SEEDED_SPACE_ID), UUID(OTHER_USER_ID))

    with pytest.raises(NotFoundError):
        space_svc.list_sources(other_user, space_id=UUID(SEEDED_SPACE_ID))


def test_collaborator_cannot_capture_or_mutate_the_space(
    other_user: User,
    space_repo: FakeSpaceRepo,
    collaborator_repo: FakeCollaboratorRepo,
    profile_repo: FakeProfileRepo,
) -> None:
    """Read-only really means read-only: viewability never satisfies an
    owner-only check, so a collaborator can't capture into or otherwise
    mutate the space they can merely view."""
    collaborator_repo.add(
        space_id=SEEDED_SPACE_ID, user_id=OTHER_USER_ID, invited_by=DEV_USER_ID
    )
    space_svc, _ = _build_services(space_repo, collaborator_repo, profile_repo)

    with pytest.raises(NotFoundError):
        space_svc.require_owned_space(other_user, UUID(SEEDED_SPACE_ID))


def test_collaborator_can_view_the_knowledge_graph(
    other_user: User,
    space_repo: FakeSpaceRepo,
    collaborator_repo: FakeCollaboratorRepo,
    profile_repo: FakeProfileRepo,
    concept_repo: FakeConceptRepo,
    llm_service: FakeLLMService,
    storage: FakeStorage,
) -> None:
    """The knowledge-map graph IS viewable (curated content) via
    require_viewable_space, using the owner's id for the underlying graph
    RPC rather than the viewer's."""
    collaborator_repo.add(
        space_id=SEEDED_SPACE_ID, user_id=OTHER_USER_ID, invited_by=DEV_USER_ID
    )
    space_svc, _ = _build_services(space_repo, collaborator_repo, profile_repo)
    concept_svc = ConceptService(
        concept_repo, space_svc, ExtractService(storage), llm_service  # type: ignore[arg-type]
    )

    graph = concept_svc.get_graph(other_user, UUID(SEEDED_SPACE_ID))
    assert graph.pending == 0
