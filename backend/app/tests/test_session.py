"""Session endpoint tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    SEEDED_SPACE_NAME,
    FakeSpaceRepo,
)


def test_get_session_requires_authentication() -> None:
    # A fresh app WITHOUT the conftest auth override: no bearer token → 401.
    resp = TestClient(create_app()).get("/v1/session")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


def test_get_session_returns_user_and_persisted_active_space(client: TestClient) -> None:
    resp = client.get("/v1/session")
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == "aditya@atlas.ai"
    assert body["active_space"]["id"] == SEEDED_SPACE_ID
    assert body["active_space"]["name"] == SEEDED_SPACE_NAME
    assert body["active_space"]["slug"] == "system-design"


def test_get_session_reports_null_active_space_when_unset(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    space_repo.active.clear()
    assert client.get("/v1/session").json()["active_space"] is None


def test_set_active_space_flips_to_another_owned_space(client: TestClient) -> None:
    created = client.post("/v1/spaces", json={"name": "Claude Code"}).json()

    resp = client.post("/v1/session/active", json={"space_id": created["id"]})
    assert resp.status_code == 204

    after = client.get("/v1/session").json()
    assert after["active_space"]["id"] == created["id"]
    assert after["active_space"]["name"] == "Claude Code"


def test_set_active_space_rejects_a_space_the_user_does_not_own(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    # The space exists — only its owner differs — so this proves ownership is
    # what authorizes, not existence.
    resp = client.post("/v1/session/active", json={"space_id": OTHER_USER_SPACE_ID})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "not_found"
    assert space_repo.get_active_space_id(
        str(space_repo.spaces[SEEDED_SPACE_ID]["user_id"])
    ) == SEEDED_SPACE_ID


def test_set_active_space_rejects_unknown_space(client: TestClient) -> None:
    resp = client.post(
        "/v1/session/active",
        json={"space_id": "00000000-0000-0000-0000-0000000000cc"},
    )
    assert resp.status_code == 404


def test_set_active_space_rejects_bad_uuid(client: TestClient) -> None:
    resp = client.post("/v1/session/active", json={"space_id": "not-a-uuid"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation"
