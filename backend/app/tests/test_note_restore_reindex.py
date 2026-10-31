"""Restoring a version must re-index search text and links (cross-feature regression)."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.dependencies import get_note_version_service, get_space_service
from app.services.note_version_service import NoteVersionService
from app.tests.test_note_versions import (  # noqa: F401  (version_repo is a fixture)
    FakeNoteVersionRepo,
    doc,
    edit,
    make_note,
    url,
    version_repo,
)


class RecordingIndexer:
    def __init__(self, *, fail: bool = False) -> None:
        self.calls: list[dict[str, Any]] = []
        self._fail = fail

    def refresh(self, *, user_id: str, note_id: str, content: Any) -> bool:
        self.calls.append({"user_id": user_id, "note_id": note_id, "content": content})
        return not self._fail


@pytest.fixture
def indexer() -> RecordingIndexer:
    return RecordingIndexer()


@pytest.fixture
def iclient(
    client: TestClient,
    version_repo: FakeNoteVersionRepo,  # noqa: F811
    space_note_repo: Any,  # noqa: F811
    indexer: RecordingIndexer,
) -> TestClient:
    space_svc = client.app.dependency_overrides[get_space_service]()
    svc = NoteVersionService(version_repo, space_note_repo, space_svc, indexer)  # type: ignore[arg-type]
    client.app.dependency_overrides[get_note_version_service] = lambda: svc
    return client


def test_restore_reindexes_with_the_restored_content(
    iclient: TestClient, indexer: RecordingIndexer
) -> None:
    note_id = make_note(iclient, "original")
    snap = iclient.post(url(note_id)).json()
    edit(iclient, note_id, content=doc("edited"))
    assert iclient.post(url(note_id, f"/{snap['id']}/restore")).status_code == 200
    assert len(indexer.calls) == 1
    assert indexer.calls[0]["note_id"] == note_id
    assert indexer.calls[0]["content"] == doc("original")


def test_snapshot_and_listing_do_not_reindex(
    iclient: TestClient, indexer: RecordingIndexer
) -> None:
    note_id = make_note(iclient)
    iclient.post(url(note_id))
    iclient.get(url(note_id))
    assert indexer.calls == []


def test_restore_still_succeeds_when_indexing_fails(
    client: TestClient,
    version_repo: FakeNoteVersionRepo,  # noqa: F811
    space_note_repo: Any,  # noqa: F811
) -> None:
    failing = RecordingIndexer(fail=True)
    space_svc = client.app.dependency_overrides[get_space_service]()
    svc = NoteVersionService(version_repo, space_note_repo, space_svc, failing)  # type: ignore[arg-type]
    client.app.dependency_overrides[get_note_version_service] = lambda: svc
    note_id = make_note(client, "original")
    snap = client.post(url(note_id)).json()
    edit(client, note_id, content=doc("edited"))
    resp = client.post(url(note_id, f"/{snap['id']}/restore"))
    assert resp.status_code == 200
    assert resp.json()["content"] == doc("original")
    assert len(failing.calls) == 1
