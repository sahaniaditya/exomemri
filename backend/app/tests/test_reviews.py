"""Product review tests: upsert-own + public top-N by rating."""

from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from app.tests.conftest import FakeProfileRepo, FakeReviewRepo

DEV_USER = "00000000-0000-0000-0000-0000000000a1"


def test_get_mine_404_when_absent(client: TestClient) -> None:
    res = client.get("/v1/reviews/me")
    assert res.status_code == 404


def test_upsert_and_get_mine(client: TestClient) -> None:
    body = {
        "rating": 5,
        "body": "It actually remembers what I've learned.",
    }
    created = client.put("/v1/reviews/me", json=body)
    assert created.status_code == 200
    payload = created.json()
    assert payload["rating"] == 5
    assert payload["body"] == body["body"]
    assert payload["id"]

    fetched = client.get("/v1/reviews/me")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == payload["id"]
    assert fetched.json()["rating"] == 5


def test_upsert_replaces_existing_review(client: TestClient) -> None:
    first = client.put(
        "/v1/reviews/me",
        json={"rating": 3, "body": "Decent so far, still exploring."},
    )
    assert first.status_code == 200
    first_id = first.json()["id"]

    second = client.put(
        "/v1/reviews/me",
        json={"rating": 5, "body": "Now it's indispensable for my learning."},
    )
    assert second.status_code == 200
    assert second.json()["id"] == first_id
    assert second.json()["rating"] == 5


def test_upsert_rejects_short_body(client: TestClient) -> None:
    res = client.put("/v1/reviews/me", json={"rating": 4, "body": "too short"})
    assert res.status_code == 422


def test_upsert_rejects_whitespace_only_body(client: TestClient) -> None:
    res = client.put(
        "/v1/reviews/me",
        json={"rating": 4, "body": "          "},
    )
    assert res.status_code == 422


def test_top_returns_empty_when_none(client: TestClient) -> None:
    res = client.get("/v1/reviews/top")
    assert res.status_code == 200
    assert res.json() == {"items": []}


def test_top_orders_by_rating_desc(
    client: TestClient,
    review_repo: FakeReviewRepo,
    profile_repo: FakeProfileRepo,
) -> None:
    other_id = str(uuid4())
    profile_repo.profiles[other_id] = {
        "id": other_id,
        "username": "other",
        "full_name": "Other User",
        "primary_role": "Student",
    }
    review_repo.upsert(
        user_id=DEV_USER,
        rating=3,
        body="Solid tool once you get going with it.",
    )
    review_repo.upsert(
        user_id=other_id,
        rating=5,
        body="Best learning memory tool I've tried yet.",
    )

    res = client.get("/v1/reviews/top")
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 2
    assert items[0]["rating"] == 5
    assert items[0]["full_name"] == "Other User"
    assert items[0]["primary_role"] == "Student"
    assert items[1]["rating"] == 3
    assert items[1]["full_name"] == "Dev User"


def test_top_limits_to_five(
    client: TestClient,
    review_repo: FakeReviewRepo,
    profile_repo: FakeProfileRepo,
) -> None:
    for i in range(6):
        uid = str(uuid4()) if i else DEV_USER
        if i:
            profile_repo.profiles[uid] = {
                "id": uid,
                "username": f"user{i}",
                "full_name": f"User {i}",
                "primary_role": "Professional",
            }
        review_repo.upsert(
            user_id=uid,
            rating=5 if i < 5 else 1,
            body=f"Review body number {i} is long enough.",
        )

    res = client.get("/v1/reviews/top")
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 5
    assert all(item["rating"] == 5 for item in items)


def test_top_route_has_no_auth_dependency() -> None:
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

    route = next(r for r in all_routes if getattr(r, "path", None) == "/reviews/top")
    calls = {d.call for d in _flatten(route.dependant)}
    assert get_authenticated_app_user not in calls
    assert get_authenticated_user not in calls
