"""Note version history tests (hermetic: fake repos only)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from itertools import count
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_note_version_service, get_space_service
from app.schemas.note_versions import MAX_VERSIONS_PER_NOTE
from app.services.note_version_service import NoteVersionService
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeSpaceNoteRepo,
)

SPACE = SEEDED_SPACE_ID
OTHER_USER = "00000000-0000-0000-0000-0000000000ff"
BASE_TIME = datetime(2026, 1, 1, tzinfo=UTC)


class FakeNoteVersionRepo:
    """In-memory ``note_versions`` table with strictly increasing timestamps."""

    def __init__(self) -> None:
        self.rows: dict[str, dict] = {}
        self._tick = count()

    def insert(
        self, *, note_id: str, user_id: str, title: str, content: dict, reason: str
    ) -> dict:
        row = {
            "id": str(uuid4()),
            "note_id": note_id,
            "user_id": user_id,
            "title": title,
            "content": content,
            "reason": reason,
            "created_at": (BASE_TIME + timedelta(seconds=next(self._tick))).isoformat(),
        }
        self.rows[row["id"]] = row
        return row

    def _for(self, note_id: str, user_id: str) -> list[dict]:
        rows = [
            r for r in self.rows.values() if r["note_id"] == note_id and r["user_id"] == user_id
        ]
        return sorted(rows, key=lambda r: r["created_at"], reverse=True)

    def latest(self, *, note_id: str, user_id: str) -> dict | None:
        rows = self._for(note_id, user_id)
        return rows[0] if rows else None

    def list_summaries(self, *, note_id: str, user_id: str) -> list[dict]:
        return [
            {k: r[k] for k in ("id", "title", "reason", "created_at")}
            for r in self._for(note_id, user_id)
        ]

    def get(self, *, note_id: str, version_id: str, user_id: str) -> dict | None:
        row = self.rows.get(version_id)
        if not row or row["note_id"] != note_id or row["user_id"] != user_id:
            return None
        return row

    def prune(self, *, note_id: str, user_id: str, keep: int) -> int:
        stale = self._for(note_id, user_id)[keep:]
        for row in stale:
            del self.rows[row["id"]]
        return len(stale)


def doc(text: str) -> dict:
    return {
        "type": "doc",
        "content": [{"type": "paragraph", "content": [{"type": "text", "text": text}]}],
    }


def foreign_note(repo: FakeSpaceNoteRepo) -> str:
    note_id = str(uuid4())
    repo.insert(
        note_id=note_id,
        space_id=OTHER_USER_SPACE_ID,
        user_id=OTHER_USER,
        title="theirs",
        content=doc("secret"),
        sort_order=0,
    )
    return note_id


@pytest.fixture
def version_repo() -> FakeNoteVersionRepo:
    return FakeNoteVersionRepo()


@pytest.fixture
def vclient(
    client: TestClient,
    version_repo: FakeNoteVersionRepo,
    space_note_repo: FakeSpaceNoteRepo,
) -> TestClient:
    space_svc = client.app.dependency_overrides[get_space_service]()
    svc = NoteVersionService(version_repo, space_note_repo, space_svc)  # type: ignore[arg-type]
    client.app.dependency_overrides[get_note_version_service] = lambda: svc
    return client


def make_note(client: TestClient, text: str = "v1", title: str = "Note") -> str:
    note_id = client.post(f"/v1/spaces/{SPACE}/notes", json={"title": title}).json()["id"]
    put = client.put(f"/v1/spaces/{SPACE}/notes/{note_id}", json={"content": doc(text)})
    assert put.status_code == 200
    return note_id


def edit(client: TestClient, note_id: str, **body: object) -> None:
    resp = client.put(f"/v1/spaces/{SPACE}/notes/{note_id}", json=body)
    assert resp.status_code == 200


def url(note_id: str, suffix: str = "", space: str = SPACE) -> str:
    return f"/v1/spaces/{space}/notes/{note_id}/versions{suffix}"


def test_create_snapshot_stores_current_title_and_content(vclient: TestClient) -> None:
    note_id = make_note(vclient, "hello", "Title A")
    resp = vclient.post(url(note_id))
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Title A"
    assert body["reason"] == "idle"
    assert "content" not in body
    full = vclient.get(url(note_id, f"/{body['id']}")).json()
    assert full["content"] == doc("hello")
    assert full["title"] == "Title A"


def test_manual_reason_is_accepted_and_pre_restore_is_rejected(vclient: TestClient) -> None:
    note_id = make_note(vclient)
    ok = vclient.post(url(note_id), json={"reason": "manual"})
    assert ok.json()["reason"] == "manual"
    bad = vclient.post(url(note_id), json={"reason": "pre_restore"})
    assert bad.status_code == 422


def test_identical_snapshot_is_a_noop_returning_latest(
    vclient: TestClient, version_repo: FakeNoteVersionRepo
) -> None:
    note_id = make_note(vclient)
    first = vclient.post(url(note_id)).json()
    second = vclient.post(url(note_id)).json()
    assert second["id"] == first["id"]
    assert len(version_repo.rows) == 1
    edit(vclient, note_id, content=doc("changed"))
    third = vclient.post(url(note_id)).json()
    assert third["id"] != first["id"]
    assert len(version_repo.rows) == 2


def test_title_change_alone_creates_a_new_version(vclient: TestClient) -> None:
    note_id = make_note(vclient)
    first = vclient.post(url(note_id)).json()
    edit(vclient, note_id, title="Renamed")
    second = vclient.post(url(note_id)).json()
    assert second["id"] != first["id"]
    assert second["title"] == "Renamed"


def test_list_is_newest_first_without_content(vclient: TestClient) -> None:
    note_id = make_note(vclient, "zero")
    ids = []
    for text in ("one", "two", "three"):
        edit(vclient, note_id, content=doc(text))
        ids.append(vclient.post(url(note_id)).json()["id"])
    items = vclient.get(url(note_id)).json()["items"]
    assert [i["id"] for i in items] == list(reversed(ids))
    assert all(set(i) == {"id", "title", "reason", "created_at"} for i in items)


def test_cap_keeps_newest_fifty(vclient: TestClient, version_repo: FakeNoteVersionRepo) -> None:
    note_id = make_note(vclient, "x")
    last = ""
    for n in range(MAX_VERSIONS_PER_NOTE + 7):
        edit(vclient, note_id, content=doc(str(n)))
        last = vclient.post(url(note_id)).json()["id"]
    items = vclient.get(url(note_id)).json()["items"]
    assert len(items) == MAX_VERSIONS_PER_NOTE
    assert len(version_repo.rows) == MAX_VERSIONS_PER_NOTE
    assert items[0]["id"] == last
    oldest = vclient.get(url(note_id, f"/{items[-1]['id']}")).json()
    assert oldest["content"] == doc("7")  # versions 0..6 were pruned


def test_cap_is_per_note(vclient: TestClient) -> None:
    a = make_note(vclient, "a")
    b = make_note(vclient, "b")
    for n in range(MAX_VERSIONS_PER_NOTE + 2):
        edit(vclient, a, content=doc(str(n)))
        vclient.post(url(a))
    vclient.post(url(b))
    assert len(vclient.get(url(a)).json()["items"]) == MAX_VERSIONS_PER_NOTE
    assert len(vclient.get(url(b)).json()["items"]) == 1


def test_restore_snapshots_current_then_replaces_content_and_bumps_updated_at(
    vclient: TestClient,
) -> None:
    note_id = make_note(vclient, "original", "Old title")
    snap = vclient.post(url(note_id)).json()
    edit(vclient, note_id, title="New title", content=doc("edited"))
    before = vclient.get(f"/v1/spaces/{SPACE}/notes").json()["items"][0]["updated_at"]

    resp = vclient.post(url(note_id, f"/{snap['id']}/restore"))
    assert resp.status_code == 200
    page = resp.json()
    assert page["id"] == note_id
    assert page["space_id"] == SPACE
    assert page["title"] == "Old title"
    assert page["content"] == doc("original")
    assert page["updated_at"] != before

    items = vclient.get(url(note_id)).json()["items"]
    assert items[0]["reason"] == "pre_restore"
    assert items[0]["title"] == "New title"
    pre = vclient.get(url(note_id, f"/{items[0]['id']}")).json()
    assert pre["content"] == doc("edited")
    listed = vclient.get(f"/v1/spaces/{SPACE}/notes").json()["items"][0]
    assert listed["content"] == doc("original")
    assert listed["title"] == "Old title"


def test_restore_takes_pre_restore_snapshot_even_if_unchanged(
    vclient: TestClient, version_repo: FakeNoteVersionRepo
) -> None:
    note_id = make_note(vclient)
    snap = vclient.post(url(note_id)).json()
    assert vclient.post(url(note_id, f"/{snap['id']}/restore")).status_code == 200
    reasons = [r["reason"] for r in version_repo.rows.values()]
    assert reasons.count("pre_restore") == 1


def test_missing_note_and_version_are_404(vclient: TestClient) -> None:
    note_id = make_note(vclient)
    ghost = str(uuid4())
    assert vclient.post(url(ghost)).status_code == 404
    assert vclient.get(url(ghost)).status_code == 404
    assert vclient.get(url(note_id, f"/{ghost}")).status_code == 404
    assert vclient.post(url(note_id, f"/{ghost}/restore")).status_code == 404
    assert vclient.get(url(note_id, "/not-a-uuid")).status_code == 422


def test_unknown_space_is_404(vclient: TestClient) -> None:
    note_id = make_note(vclient)
    assert vclient.get(url(note_id, space=str(uuid4()))).status_code == 404


def test_other_users_space_is_denied(
    vclient: TestClient, space_note_repo: FakeSpaceNoteRepo
) -> None:
    foreign = foreign_note(space_note_repo)
    assert vclient.post(url(foreign, space=OTHER_USER_SPACE_ID)).status_code == 404
    assert vclient.get(url(foreign, space=OTHER_USER_SPACE_ID)).status_code == 404


def test_note_from_another_space_is_not_reachable_through_my_space(
    vclient: TestClient, space_note_repo: FakeSpaceNoteRepo
) -> None:
    foreign = foreign_note(space_note_repo)
    assert vclient.post(url(foreign)).status_code == 404
    assert vclient.get(url(foreign)).status_code == 404


def test_version_of_one_note_is_not_usable_via_another_note(vclient: TestClient) -> None:
    a = make_note(vclient, "a")
    b = make_note(vclient, "b")
    snap = vclient.post(url(a)).json()
    assert vclient.get(url(b, f"/{snap['id']}")).status_code == 404
    assert vclient.post(url(b, f"/{snap['id']}/restore")).status_code == 404


def test_version_owned_by_another_user_is_not_readable(
    vclient: TestClient, version_repo: FakeNoteVersionRepo
) -> None:
    note_id = make_note(vclient)
    other = version_repo.insert(
        note_id=note_id, user_id=OTHER_USER, title="x", content=doc("x"), reason="idle"
    )
    assert vclient.get(url(note_id, f"/{other['id']}")).status_code == 404
    assert vclient.get(url(note_id)).json()["items"] == []
