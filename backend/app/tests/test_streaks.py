"""Streak tests: StreakService logic, plus its two trigger points."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

from app.services.streak_service import StreakService
from app.tests.conftest import SEEDED_SPACE_ID, FakeProfileRepo, FakeReviewRepo, FakeSpaceRepo

DEV_USER = "00000000-0000-0000-0000-0000000000a1"
SPACE = SEEDED_SPACE_ID


def _iso_days_ago(days: int) -> str:
    return (datetime.now(UTC).date() - timedelta(days=days)).isoformat()


# --- StreakService unit tests, no HTTP ---


def test_first_ever_activity_sets_streak_to_one() -> None:
    repo = FakeProfileRepo()
    repo.profiles[DEV_USER] = {"id": DEV_USER, "current_streak": 0, "longest_streak": 0}
    StreakService(repo).record_activity(DEV_USER)  # type: ignore[arg-type]

    profile = repo.profiles[DEV_USER]
    assert profile["current_streak"] == 1
    assert profile["longest_streak"] == 1
    assert profile["last_active_date"] == datetime.now(UTC).date().isoformat()


def test_consecutive_day_activity_increments() -> None:
    repo = FakeProfileRepo()
    repo.profiles[DEV_USER] = {
        "id": DEV_USER,
        "current_streak": 3,
        "longest_streak": 5,
        "last_active_date": _iso_days_ago(1),
    }
    StreakService(repo).record_activity(DEV_USER)  # type: ignore[arg-type]

    profile = repo.profiles[DEV_USER]
    assert profile["current_streak"] == 4
    assert profile["longest_streak"] == 5


def test_same_day_repeat_action_is_a_no_op() -> None:
    repo = FakeProfileRepo()
    repo.profiles[DEV_USER] = {
        "id": DEV_USER,
        "current_streak": 3,
        "longest_streak": 3,
        "last_active_date": datetime.now(UTC).date().isoformat(),
    }
    StreakService(repo).record_activity(DEV_USER)  # type: ignore[arg-type]

    assert repo.profiles[DEV_USER]["current_streak"] == 3


def test_gap_day_resets_to_one() -> None:
    repo = FakeProfileRepo()
    repo.profiles[DEV_USER] = {
        "id": DEV_USER,
        "current_streak": 10,
        "longest_streak": 10,
        "last_active_date": _iso_days_ago(3),
    }
    StreakService(repo).record_activity(DEV_USER)  # type: ignore[arg-type]

    profile = repo.profiles[DEV_USER]
    assert profile["current_streak"] == 1
    assert profile["longest_streak"] == 10  # never decreases


def test_missing_profile_is_a_no_op() -> None:
    repo = FakeProfileRepo()
    StreakService(repo).record_activity(DEV_USER)  # type: ignore[arg-type]
    assert DEV_USER not in repo.profiles


# --- trigger points, through the real HTTP surface ---


def test_capturing_a_source_records_activity(
    client: TestClient, profile_repo: FakeProfileRepo
) -> None:
    client.post(
        "/v1/sources",
        json={
            "space_id": SPACE,
            "type": "article",
            "url": "https://example.com/post",
            "title": "Post",
            "content": "cleaned article text",
        },
    )
    assert profile_repo.profiles[DEV_USER]["current_streak"] == 1


def test_marking_a_review_item_reviewed_records_activity(
    client: TestClient,
    space_repo: FakeSpaceRepo,
    review_repo: FakeReviewRepo,
    profile_repo: FakeProfileRepo,
) -> None:
    source_id = str(uuid4())
    space_repo.sources[source_id] = {
        "id": source_id,
        "space_id": SPACE,
        "user_id": DEV_USER,
        "type": "note",
        "title": "A note",
        "captured_at": "2026-08-18T00:00:00+00:00",
    }
    item_id = str(uuid4())
    review_repo.items[item_id] = {
        "id": item_id,
        "source_id": source_id,
        "space_id": SPACE,
        "user_id": DEV_USER,
        "prompt_text": "Explain the thing",
        "last_reviewed_at": None,
    }

    resp = client.post(f"/v1/spaces/{SPACE}/review/{item_id}/reviewed")

    assert resp.status_code == 200
    assert profile_repo.profiles[DEV_USER]["current_streak"] == 1
