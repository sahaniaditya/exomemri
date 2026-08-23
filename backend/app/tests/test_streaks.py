"""Streak tests: StreakService logic, plus the capture trigger point."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.services.streak_service import StreakService
from app.tests.conftest import SEEDED_SPACE_ID, FakeProfileRepo

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
