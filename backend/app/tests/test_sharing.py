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

from app.config import get_settings
from app.errors import ConflictError, NotFoundError
from app.schemas.common import User
from app.services.concept_service import ConceptService
from app.services.coverage_service import CoverageService
from app.services.credits_service import CreditsService
from app.services.extract_service import ExtractService
from app.services.rate_limit_service import NoopRateLimiter
from app.services.sharing_service import SharingService
from app.services.source_chat_service import SourceChatService
from app.services.space_service import SpaceService
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeCollaboratorRepo,
    FakeConceptRepo,
    FakeCoverageRepo,
    FakeCreditsRepo,
    FakeLLMService,
    FakeNoteRepo,
    FakeProfileRepo,
    FakeShareLinkRepo,
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
    share_link_repo: FakeShareLinkRepo | None = None,
) -> tuple[SpaceService, SharingService]:
    space_svc = SpaceService(space_repo, collaborator_repo, FakeStorage())  # type: ignore[arg-type]
    sharing_svc = SharingService(
        collaborator_repo,
        space_svc,
        profile_repo,
        share_link_repo or FakeShareLinkRepo(),  # type: ignore[arg-type]
    )
    return space_svc, sharing_svc


# --- owner-side HTTP: invite/list/revoke ---


def test_invite_unknown_username_is_generic_not_found(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    """Missing usernames share one 404 envelope — no copy or detail that
    distinguishes 'nobody' from 'alsomissing' (username enumeration)."""
    source = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    first = client.post(
        f"/v1/sources/{source['id']}/collaborators", json={"username": "nobody"}
    )
    second = client.post(
        f"/v1/sources/{source['id']}/collaborators", json={"username": "alsomissing"}
    )
    assert first.status_code == 404
    assert second.status_code == 404
    assert first.json() == second.json()
    error = first.json()["error"]
    assert error["message"] == "Unable to invite that user."
    assert "detail" not in error


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
        space_svc,
        extracts,
        llm_service,
        None,
        None,
        CreditsService(FakeCreditsRepo()),  # type: ignore[arg-type]
    )
    summary = asyncio.run(
        chat_svc.get_summary(user=other_user, source_id=UUID(source_a["id"]))
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

    credits = CreditsService(FakeCreditsRepo())  # type: ignore[arg-type]
    coverage = CoverageService(
        FakeCoverageRepo(),
        concept_repo,
        space_svc,
        llm_service,
        NoopRateLimiter(),
        get_settings(),
        credits,  # type: ignore[arg-type]
    )
    concept_svc = ConceptService(
        concept_repo, space_svc, ExtractService(storage), llm_service, credits, coverage  # type: ignore[arg-type]
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


# --- shareable links ---


def test_create_or_get_share_link_returns_token(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    source = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    created = client.put(f"/v1/sources/{source['id']}/share-link")
    assert created.status_code == 200
    body = created.json()
    assert body["token"]
    assert body["path"] == f"/s/{body['token']}"

    again = client.put(f"/v1/sources/{source['id']}/share-link")
    assert again.status_code == 200
    assert again.json()["token"] == body["token"]

    status = client.get(f"/v1/sources/{source['id']}/share-link")
    assert status.status_code == 200
    assert status.json()["enabled"] is True
    assert status.json()["token"] == body["token"]


def test_share_link_status_disabled_when_absent(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    source = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    status = client.get(f"/v1/sources/{source['id']}/share-link")
    assert status.status_code == 200
    assert status.json() == {
        "enabled": False,
        "token": None,
        "path": None,
        "created_at": None,
    }


def test_redeem_grants_view_access(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    share_link_repo: FakeShareLinkRepo,
    collaborator_repo: FakeCollaboratorRepo,
    profile_repo: FakeProfileRepo,
) -> None:
    """Other user owns the capture; hermetic client authenticates as DEV and redeems."""
    source = _seed_source(
        space_repo, space_id=OTHER_USER_SPACE_ID, user_id=OTHER_USER_ID
    )
    profile_repo.profiles[OTHER_USER_ID] = {
        "id": OTHER_USER_ID,
        "username": "other",
    }
    token = "test-share-token-abc"
    share_link_repo.create(
        source_id=source["id"],
        space_id=OTHER_USER_SPACE_ID,
        token=token,
        created_by=OTHER_USER_ID,
    )

    redeem = client.post(f"/v1/share-links/{token}/redeem")
    assert redeem.status_code == 200
    data = redeem.json()
    assert data["source_id"] == source["id"]
    assert data["is_owner"] is False
    assert data["owner_username"] == "other"
    assert collaborator_repo.is_collaborator(
        source_id=source["id"], user_id=DEV_USER_ID
    )

    assert client.get(f"/v1/sources/{source['id']}/summary").status_code == 200

    # Idempotent second redeem
    assert client.post(f"/v1/share-links/{token}/redeem").status_code == 200


def test_revoke_link_blocks_new_redeem_but_keeps_prior_viewer(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    share_link_repo: FakeShareLinkRepo,
    collaborator_repo: FakeCollaboratorRepo,
    profile_repo: FakeProfileRepo,
    other_user: User,
) -> None:
    source = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    profile_repo.profiles[OTHER_USER_ID] = {"id": OTHER_USER_ID, "username": "friend"}
    created = client.put(f"/v1/sources/{source['id']}/share-link")
    token = created.json()["token"]

    # Simulate other user already redeemed via direct grant
    collaborator_repo.add(
        source_id=source["id"],
        space_id=SEEDED_SPACE_ID,
        user_id=OTHER_USER_ID,
        invited_by=DEV_USER_ID,
    )

    revoke = client.delete(f"/v1/sources/{source['id']}/share-link")
    assert revoke.status_code == 204

    status = client.get(f"/v1/sources/{source['id']}/share-link")
    assert status.json()["enabled"] is False

    assert share_link_repo.get_active_by_token(token=token) is None

    space_svc, _ = _build_services(space_repo, collaborator_repo, profile_repo)
    viewed = space_svc.require_viewable_source(other_user, UUID(source["id"]))
    assert viewed["id"] == source["id"]


def test_revoked_token_redeem_is_not_found(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    share_link_repo: FakeShareLinkRepo,
) -> None:
    source = _seed_source(
        space_repo, space_id=OTHER_USER_SPACE_ID, user_id=OTHER_USER_ID
    )
    token = "revoked-token"
    share_link_repo.create(
        source_id=source["id"],
        space_id=OTHER_USER_SPACE_ID,
        token=token,
        created_by=OTHER_USER_ID,
    )
    share_link_repo.revoke(source_id=source["id"])

    res = client.post(f"/v1/share-links/{token}/redeem")
    assert res.status_code == 404


def test_owner_redeem_is_safe_no_self_grant(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    collaborator_repo: FakeCollaboratorRepo,
) -> None:
    source = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    created = client.put(f"/v1/sources/{source['id']}/share-link")
    token = created.json()["token"]

    redeem = client.post(f"/v1/share-links/{token}/redeem")
    assert redeem.status_code == 200
    assert redeem.json()["is_owner"] is True
    assert not collaborator_repo.is_collaborator(
        source_id=source["id"], user_id=DEV_USER_ID
    )


def test_reenable_after_revoke_issues_new_token(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    source = _seed_source(space_repo, space_id=SEEDED_SPACE_ID, user_id=DEV_USER_ID)
    first = client.put(f"/v1/sources/{source['id']}/share-link").json()["token"]
    client.delete(f"/v1/sources/{source['id']}/share-link")
    second = client.put(f"/v1/sources/{source['id']}/share-link").json()["token"]
    assert second != first
    assert client.post(f"/v1/share-links/{first}/redeem").status_code == 404
    assert client.post(f"/v1/share-links/{second}/redeem").status_code == 200
