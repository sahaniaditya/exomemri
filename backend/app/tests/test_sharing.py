"""Read-only per-capture sharing tests: invite/revoke via HTTP, and
cross-user viewer access. The hermetic ``client`` fixture always
authenticates as one fixed dev user, so a second user's viewpoint is
built by hand (same pattern as ``test_graph.py``). HTTP collaborator
reads are exercised by granting the *dev* user access to someone else's
capture.
"""

from __future__ import annotations

import asyncio
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.errors import ConflictError, NotFoundError
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
    FakeNoteRepo,
    FakeProfileRepo,
    FakeSpaceRepo,
    FakeStorage,
)

DEV_USER_ID = "00000000-0000-0000-0000-0000000000a1"
OTHER_USER_ID = "00000000-0000-0000-0000-0000000000ff"


@pytest.fixture
def dev_user() -> User:
    return User(id=DEV_USER_ID, email="dev@exomemri.com")  # type: ignore[arg-type]


@pytest.fixture
def other_user() -> User:
    return User(id=OTHER_USER_ID, email="other@exomemri.com")  # type: ignore[arg-type]


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


def test_invite_unknown_username_is_not_found(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    source = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    res = client.post(
        f"/v1/sources/{source['id']}/collaborators", json={"username": "nobody"}
    )
    assert res.status_code == 404


def test_invite_into_unowned_source_is_not_found(
    client: TestClient, space_repo: FakeSpaceRepo, profile_repo: FakeProfileRepo
) -> None:
    profile_repo.profiles[OTHER_USER_ID] = {"id": OTHER_USER_ID, "username": "friend"}
    source = _seed_source(
        space_repo, space_id=OTHER_USER_SPACE_ID, user_id=OTHER_USER_ID
    )
    res = client.post(
        f"/v1/sources/{source['id']}/collaborators", json={"username": "friend"}
    )
    assert res.status_code == 404


def test_invite_grants_and_lists_a_collaborator(
    client: TestClient, space_repo: FakeSpaceRepo, profile_repo: FakeProfileRepo
) -> None:
    source = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    profile_repo.profiles[OTHER_USER_ID] = {
        "id": OTHER_USER_ID,
        "username": "friend",
        "full_name": "A Friend",
    }

    invite = client.post(
        f"/v1/sources/{source['id']}/collaborators", json={"username": "friend"}
    )
    assert invite.status_code == 201
    assert invite.json()["username"] == "friend"

    listed = client.get(f"/v1/sources/{source['id']}/collaborators")
    assert listed.status_code == 200
    assert [c["username"] for c in listed.json()["collaborators"]] == ["friend"]


def test_inviting_the_same_person_twice_conflicts(
    client: TestClient, space_repo: FakeSpaceRepo, profile_repo: FakeProfileRepo
) -> None:
    source = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    profile_repo.profiles[OTHER_USER_ID] = {"id": OTHER_USER_ID, "username": "friend"}
    client.post(f"/v1/sources/{source['id']}/collaborators", json={"username": "friend"})
    second = client.post(
        f"/v1/sources/{source['id']}/collaborators", json={"username": "friend"}
    )
    assert second.status_code == 409

    listed = client.get(f"/v1/sources/{source['id']}/collaborators")
    assert len(listed.json()["collaborators"]) == 1


def test_revoke_removes_the_collaborator(
    client: TestClient, space_repo: FakeSpaceRepo, profile_repo: FakeProfileRepo
) -> None:
    source = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    profile_repo.profiles[OTHER_USER_ID] = {"id": OTHER_USER_ID, "username": "friend"}
    client.post(f"/v1/sources/{source['id']}/collaborators", json={"username": "friend"})

    revoke = client.delete(
        f"/v1/sources/{source['id']}/collaborators/{OTHER_USER_ID}"
    )
    assert revoke.status_code == 204

    listed = client.get(f"/v1/sources/{source['id']}/collaborators")
    assert listed.json()["collaborators"] == []


def test_cannot_invite_yourself(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    source = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    res = client.post(
        f"/v1/sources/{source['id']}/collaborators", json={"username": "dev"}
    )
    assert res.status_code == 422


def test_shared_with_me_lists_a_capture_granted_to_the_caller(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    collaborator_repo: FakeCollaboratorRepo,
    profile_repo: FakeProfileRepo,
) -> None:
    source = _seed_source(
        space_repo, space_id=OTHER_USER_SPACE_ID, user_id=OTHER_USER_ID
    )
    profile_repo.profiles[OTHER_USER_ID] = {
        "id": OTHER_USER_ID,
        "username": "other",
    }
    collaborator_repo.add(
        source_id=source["id"],
        space_id=OTHER_USER_SPACE_ID,
        user_id=DEV_USER_ID,
        invited_by=OTHER_USER_ID,
    )
    res = client.get("/v1/shared-with-me")
    assert res.status_code == 200
    sources = res.json()["sources"]
    assert [s["source_id"] for s in sources] == [source["id"]]
    assert sources[0]["title"] == "A note"
    assert sources[0]["space_name"] == space_repo.spaces[OTHER_USER_SPACE_ID]["name"]
    assert sources[0]["owner_username"] == "other"


# --- viewer-side authorization ---


def test_collaborator_can_read_granted_source_but_not_a_sibling(
    dev_user: User,
    other_user: User,
    space_repo: FakeSpaceRepo,
    collaborator_repo: FakeCollaboratorRepo,
    profile_repo: FakeProfileRepo,
    storage: FakeStorage,
    llm_service: FakeLLMService,
) -> None:
    space_svc, sharing_svc = _build_services(space_repo, collaborator_repo, profile_repo)
    source_a = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    source_b = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    profile_repo.profiles[OTHER_USER_ID] = {"id": OTHER_USER_ID, "username": "friend"}
    sharing_svc.invite(dev_user, UUID(source_a["id"]), "friend")

    viewed = space_svc.require_viewable_source(other_user, UUID(source_a["id"]))
    assert viewed["id"] == source_a["id"]

    extracts = ExtractService(storage)  # type: ignore[arg-type]
    chat_svc = SourceChatService(
        space_svc, extracts, llm_service, None, None  # type: ignore[arg-type]
    )
    summary = asyncio.run(
        chat_svc.get_or_create_summary(user=other_user, source_id=UUID(source_a["id"]))
    )
    assert summary.summary == "A summary"

    with pytest.raises(NotFoundError):
        space_svc.require_viewable_source(other_user, UUID(source_b["id"]))
    with pytest.raises(NotFoundError):
        space_svc.list_sources(other_user, space_id=UUID(SEEDED_SPACE_ID))


def test_duplicate_invite_raises_conflict(
    dev_user: User,
    space_repo: FakeSpaceRepo,
    collaborator_repo: FakeCollaboratorRepo,
    profile_repo: FakeProfileRepo,
) -> None:
    space_svc, sharing_svc = _build_services(space_repo, collaborator_repo, profile_repo)
    source = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    profile_repo.profiles[OTHER_USER_ID] = {"id": OTHER_USER_ID, "username": "friend"}
    sharing_svc.invite(dev_user, UUID(source["id"]), "friend")
    with pytest.raises(ConflictError):
        sharing_svc.invite(dev_user, UUID(source["id"]), "friend")


def test_revoked_collaborator_loses_view_access(
    dev_user: User,
    other_user: User,
    space_repo: FakeSpaceRepo,
    collaborator_repo: FakeCollaboratorRepo,
    profile_repo: FakeProfileRepo,
) -> None:
    space_svc, sharing_svc = _build_services(space_repo, collaborator_repo, profile_repo)
    source = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    profile_repo.profiles[OTHER_USER_ID] = {"id": OTHER_USER_ID, "username": "friend"}
    sharing_svc.invite(dev_user, UUID(source["id"]), "friend")
    sharing_svc.revoke(dev_user, UUID(source["id"]), UUID(OTHER_USER_ID))

    with pytest.raises(NotFoundError):
        space_svc.require_viewable_source(other_user, UUID(source["id"]))


def test_collaborator_cannot_mutate_or_see_the_space_graph(
    other_user: User,
    space_repo: FakeSpaceRepo,
    collaborator_repo: FakeCollaboratorRepo,
    profile_repo: FakeProfileRepo,
    concept_repo: FakeConceptRepo,
    llm_service: FakeLLMService,
    storage: FakeStorage,
) -> None:
    source = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    collaborator_repo.add(
        source_id=source["id"],
        space_id=SEEDED_SPACE_ID,
        user_id=OTHER_USER_ID,
        invited_by=DEV_USER_ID,
    )
    space_svc, _ = _build_services(space_repo, collaborator_repo, profile_repo)

    with pytest.raises(NotFoundError):
        space_svc.require_owned_source(other_user, UUID(source["id"]))
    with pytest.raises(NotFoundError):
        space_svc.require_owned_space(other_user, UUID(SEEDED_SPACE_ID))

    concept_svc = ConceptService(
        concept_repo, space_svc, ExtractService(storage), llm_service  # type: ignore[arg-type]
    )
    with pytest.raises(NotFoundError):
        concept_svc.get_graph(other_user, UUID(SEEDED_SPACE_ID))


def test_collaborator_http_can_read_granted_capture_only(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    collaborator_repo: FakeCollaboratorRepo,
    note_repo: FakeNoteRepo,
) -> None:
    """Dev user is the collaborator; the other user owns two captures."""
    source_a = _seed_source(
        space_repo, space_id=OTHER_USER_SPACE_ID, user_id=OTHER_USER_ID
    )
    source_b = _seed_source(
        space_repo, space_id=OTHER_USER_SPACE_ID, user_id=OTHER_USER_ID
    )
    note_id = str(uuid4())
    note_repo.notes[note_id] = {
        "id": note_id,
        "source_id": source_a["id"],
        "user_id": OTHER_USER_ID,
        "space_id": OTHER_USER_SPACE_ID,
        "title": "Untitled",
        "content": {"type": "doc", "content": [{"type": "paragraph"}]},
        "sort_order": 0,
        "created_at": "2026-08-18T00:00:00+00:00",
        "updated_at": "2026-08-18T00:00:00+00:00",
    }
    collaborator_repo.add(
        source_id=source_a["id"],
        space_id=OTHER_USER_SPACE_ID,
        user_id=DEV_USER_ID,
        invited_by=OTHER_USER_ID,
    )

    assert client.get(f"/v1/sources/{source_a['id']}/summary").status_code == 200
    notes = client.get(f"/v1/sources/{source_a['id']}/notes")
    assert notes.status_code == 200
    assert notes.json()["items"][0]["content"]["type"] == "doc"

    artifact = client.get(
        f"/v1/sources/{source_a['id']}/artifact-url?key=raw/extracted.txt"
    )
    assert artifact.status_code == 200

    assert client.get(f"/v1/sources/{source_b['id']}/summary").status_code == 404
    assert client.get(f"/v1/sources/{source_b['id']}/notes").status_code == 404
    assert (
        client.get(f"/v1/sources/{source_b['id']}/artifact-url?key=raw/extracted.txt")
        .status_code
        == 404
    )

    assert (
        client.put(
            f"/v1/sources/{source_a['id']}/notes/{note_id}",
            json={"content": {"type": "doc", "content": []}},
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/v1/sources/{source_a['id']}/notes",
            json={"title": "Nope"},
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/v1/sources/{source_a['id']}/messages",
            json={"content": "hello"},
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/v1/sources/{source_a['id']}/collaborators",
            json={"username": "dev"},
        ).status_code
        == 404
    )
    assert client.get(f"/v1/spaces/{OTHER_USER_SPACE_ID}/graph").status_code == 404
    assert client.get(f"/v1/spaces/{OTHER_USER_SPACE_ID}/sources").status_code == 404
