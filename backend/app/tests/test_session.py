"""Session endpoint tests (dev-stub)."""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_get_session_returns_dev_user_and_active_space(client: TestClient) -> None:
    resp = client.get("/v1/session")
    assert resp.status_code == 200
    body = resp.json()
    assert body["user"]["email"] == "aditya@kimaru.ai"
    assert body["active_space"] is not None
    assert body["active_space"]["name"] == "System Design"


def test_set_active_space_flips_active_space(client: TestClient) -> None:
    new_space = "00000000-0000-0000-0000-0000000000cc"
    resp = client.post("/v1/session/active", json={"space_id": new_space})
    assert resp.status_code == 204

    after = client.get("/v1/session").json()
    assert after["active_space"]["id"] == new_space


def test_set_active_space_rejects_bad_uuid(client: TestClient) -> None:
    resp = client.post("/v1/session/active", json={"space_id": "not-a-uuid"})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation"
