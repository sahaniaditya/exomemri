"""Public learning profile tests: opt-in gating, scope of exposed fields."""

from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from app.tests.conftest import SEEDED_SPACE_ID, FakeSpaceRepo

DEV_USER = "00000000-0000-0000-0000-0000000000a1"


def _seed_source(space_repo: FakeSpaceRepo) -> None:
    source_id = str(uuid4())
    space_repo.sources[source_id] = {
        "id": source_id,
        "space_id": SEEDED_SPACE_ID,
        "user_id": DEV_USER,
        "type": "note",
        "title": "A note",
        "captured_at": "2026-08-18T00:00:00+00:00",
    }


def test_profile_is_not_found_before_opting_in(client: TestClient) -> None:
    res = client.get("/v1/profiles/dev")
    assert res.status_code == 404


def test_nonexistent_username_is_not_found_identically(client: TestClient) -> None:
    res = client.get("/v1/profiles/nobody-at-all")
    assert res.status_code == 404


def test_visibility_defaults_to_private(client: TestClient) -> None:
    res = client.get("/v1/profile/visibility")
    assert res.status_code == 200
    assert res.json() == {"profile_public": False}


def test_opting_in_makes_the_profile_public(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    _seed_source(space_repo)

    toggle = client.put("/v1/profile/visibility", json={"profile_public": True})
    assert toggle.status_code == 200
    assert toggle.json() == {"profile_public": True}

    res = client.get("/v1/profiles/dev")
    assert res.status_code == 200
    body = res.json()
    assert body["username"] == "dev"
    assert body["full_name"] == "Dev User"
    assert body["current_streak"] == 0
    assert len(body["spaces"]) == 1
    assert body["spaces"][0]["name"] == "System Design"
    assert body["spaces"][0]["source_count"] == 1


def test_empty_spaces_are_omitted_from_the_public_profile(client: TestClient) -> None:
    """SEEDED_SPACE_ID has no sources in this test — nothing to show yet."""
    client.put("/v1/profile/visibility", json={"profile_public": True})
    res = client.get("/v1/profiles/dev")
    assert res.status_code == 200
    assert res.json()["spaces"] == []


def test_public_profile_never_exposes_goal_text_or_content(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    space_repo.spaces[SEEDED_SPACE_ID]["goal_text"] = "A secret personal goal"
    _seed_source(space_repo)
    client.put("/v1/profile/visibility", json={"profile_public": True})

    res = client.get("/v1/profiles/dev")
    body = res.json()
    assert "goal_text" not in body
    assert "goal_text" not in body["spaces"][0]
    assert set(body["spaces"][0].keys()) == {"name", "coverage_pct", "source_count"}


def test_opting_out_hides_the_profile_again(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    _seed_source(space_repo)
    client.put("/v1/profile/visibility", json={"profile_public": True})
    assert client.get("/v1/profiles/dev").status_code == 200

    client.put("/v1/profile/visibility", json={"profile_public": False})
    assert client.get("/v1/profiles/dev").status_code == 404


def test_public_profile_route_has_no_auth_dependency() -> None:
    """Structural regression guard: someone later adding
    ``Depends(get_authenticated_app_user)`` to this route would silently
    break the "no login required" promise this feature makes — assert the
    route's dependency tree never grows one, rather than relying on the
    hermetic test client's blanket auth override to notice."""
    from app.dependencies import get_authenticated_app_user, get_authenticated_user
    from app.main import create_app

    def _flatten(dependant) -> list:  # noqa: ANN001 - fastapi's internal Dependant type
        deps = list(dependant.dependencies)
        for d in dependant.dependencies:
            deps.extend(_flatten(d))
        return deps

    app = create_app()
    all_routes = []
    for wrapper in app.routes:
        sub_router = getattr(wrapper, "original_router", None)
        all_routes.extend(sub_router.routes if sub_router else [wrapper])

    route = next(r for r in all_routes if getattr(r, "path", None) == "/profiles/{username}")
    calls = {d.call for d in _flatten(route.dependant)}
    assert get_authenticated_app_user not in calls
    assert get_authenticated_user not in calls
