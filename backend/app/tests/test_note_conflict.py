"""Optimistic-concurrency (expected_updated_at) tests for capture and space notes."""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.services.note_service import check_expected_updated_at
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeNoteRepo,
    FakeSpaceNoteRepo,
    FakeSpaceRepo,
)
from app.tests.test_notes import _seed_article

SPACE = SEEDED_SPACE_ID
DOC = {"type": "doc", "content": [{"type": "paragraph"}]}


def _new_space_note(client: TestClient) -> tuple[str, str]:
    page = client.post(f"/v1/spaces/{SPACE}/notes", json={}).json()
    return f"/v1/spaces/{SPACE}/notes/{page['id']}", page["updated_at"]


def _new_capture_note(client: TestClient, space_repo: FakeSpaceRepo) -> tuple[str, str]:
    source_id = _seed_article(space_repo)
    page = client.post(f"/v1/sources/{source_id}/notes", json={}).json()
    return f"/v1/sources/{source_id}/notes/{page['id']}", page["updated_at"]


@pytest.fixture(params=["space", "capture"])
def note(request: pytest.FixtureRequest, client: TestClient, space_repo: FakeSpaceRepo) -> tuple:
    if request.param == "space":
        return _new_space_note(client)
    return _new_capture_note(client, space_repo)


def test_matching_expected_updated_at_saves(client: TestClient, note: tuple) -> None:
    url, updated_at = note
    resp = client.put(url, json={"content": DOC, "expected_updated_at": updated_at})
    assert resp.status_code == 200
    # The echoed updated_at chains into the next save.
    again = client.put(
        url, json={"title": "Second", "expected_updated_at": resp.json()["updated_at"]}
    )
    assert again.status_code == 200
    assert again.json()["title"] == "Second"


def test_mismatch_conflicts_with_envelope_and_current_value(
    client: TestClient, note: tuple
) -> None:
    url, updated_at = note
    # Another tab saves first, bumping updated_at.
    other = client.put(url, json={"title": "Other tab"})
    current = other.json()["updated_at"]
    assert current != updated_at

    resp = client.put(url, json={"content": DOC, "expected_updated_at": updated_at})
    assert resp.status_code == 409
    err = resp.json()["error"]
    assert err["code"] == "note_conflict"
    assert err["detail"] == {"updated_at": current}


def test_conflicting_save_does_not_write(client: TestClient, note: tuple) -> None:
    url, updated_at = note
    client.put(url, json={"title": "Winner"})
    client.put(url, json={"content": DOC, "expected_updated_at": updated_at})
    # Title untouched by the rejected write.
    rejected = client.put(
        url, json={"title": "Loser", "expected_updated_at": updated_at}
    )
    assert rejected.status_code == 409
    got = client.put(url, json={"content": DOC})
    assert got.json()["title"] == "Winner"


def test_omitted_expected_updated_at_still_saves(client: TestClient, note: tuple) -> None:
    url, _ = note
    client.put(url, json={"title": "Bump"})
    resp = client.put(url, json={"title": "Back-compat"})
    assert resp.status_code == 200
    assert resp.json()["title"] == "Back-compat"


def test_title_only_update_with_mismatch_conflicts(client: TestClient, note: tuple) -> None:
    url, updated_at = note
    client.put(url, json={"title": "Moved on"})
    resp = client.put(url, json={"title": "Stale", "expected_updated_at": updated_at})
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "note_conflict"


def test_different_format_same_instant_is_not_a_conflict(
    client: TestClient, space_note_repo: FakeSpaceNoteRepo
) -> None:
    url, updated_at = _new_space_note(client)
    instant = datetime.fromisoformat(updated_at)
    # Z suffix / space-free reformat of the same instant.
    reformatted = instant.strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z"
    resp = client.put(url, json={"title": "Fine", "expected_updated_at": reformatted})
    assert resp.status_code == 200


def test_other_users_space_still_forbidden_or_missing(client: TestClient) -> None:
    resp = client.put(
        f"/v1/spaces/{OTHER_USER_SPACE_ID}/notes/{uuid4()}",
        json={"title": "x", "expected_updated_at": "2026-01-01T00:00:00+00:00"},
    )
    assert resp.status_code in (403, 404)


def test_unknown_note_with_expectation_is_404(client: TestClient) -> None:
    resp = client.put(
        f"/v1/spaces/{SPACE}/notes/{uuid4()}",
        json={"title": "x", "expected_updated_at": "2026-01-01T00:00:00+00:00"},
    )
    assert resp.status_code == 404


def test_other_users_capture_note_is_404(
    client: TestClient, space_repo: FakeSpaceRepo, note_repo: FakeNoteRepo
) -> None:
    url, updated_at = _new_capture_note(client, space_repo)
    note_id = url.rsplit("/", 1)[1]
    note_repo.notes[note_id]["user_id"] = "someone-else"
    resp = client.put(url, json={"title": "x", "expected_updated_at": updated_at})
    assert resp.status_code == 404


@pytest.mark.parametrize(
    ("expected", "current", "conflict"),
    [
        (None, "2026-01-01T00:00:00+00:00", False),
        ("2026-01-01T00:00:00+00:00", "2026-01-01T00:00:00Z", False),
        ("2026-01-01T00:00:00.000000+00:00", "2026-01-01T00:00:00+00:00", False),
        ("2026-01-01T01:00:00+01:00", "2026-01-01T00:00:00+00:00", False),
        ("2026-01-01T00:00:01+00:00", "2026-01-01T00:00:00+00:00", True),
        ("garbage", "2026-01-01T00:00:00+00:00", True),
        ("2026-01-01T00:00:00+00:00", None, True),
    ],
)
def test_check_expected_updated_at_parses_datetimes(
    expected: str | None, current: str | None, conflict: bool
) -> None:
    from app.services.note_service import NoteConflictError

    row = {"updated_at": current}
    if conflict:
        with pytest.raises(NoteConflictError):
            check_expected_updated_at(row, expected)
    else:
        check_expected_updated_at(row, expected)
