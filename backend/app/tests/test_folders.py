"""Space-folder endpoints: create, list, rename, delete, and move captures."""

from __future__ import annotations

from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.errors import NotFoundError
from app.schemas.common import User
from app.services.space_service import SpaceService
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeCollaboratorRepo,
    FakeSpaceRepo,
    FakeStorage,
)

OTHER_USER_ID = "00000000-0000-0000-0000-0000000000ff"


def _capture_article(client: TestClient, *, title: str = "Post") -> dict:
    client.post(
        "/v1/sources",
        json={
            "space_id": SEEDED_SPACE_ID,
            "type": "article",
            "url": f"https://example.com/{title.lower().replace(' ', '-')}",
            "title": title,
            "content": "cleaned article text",
        },
    )
    body = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/sources").json()
    return next(s for s in body["sources"] if s["title"] == title)


def test_create_and_list_folders(client: TestClient) -> None:
    created = client.post(
        f"/v1/spaces/{SEEDED_SPACE_ID}/folders",
        json={"name": "Claude Code articles"},
    )
    assert created.status_code == 201
    folder = created.json()
    assert folder["name"] == "Claude Code articles"
    assert folder["space_id"] == SEEDED_SPACE_ID
    assert folder["source_count"] == 0

    listed = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/folders").json()
    assert [f["name"] for f in listed["folders"]] == ["Claude Code articles"]


def test_create_folder_rejects_a_duplicate_name(client: TestClient) -> None:
    client.post(
        f"/v1/spaces/{SEEDED_SPACE_ID}/folders", json={"name": "Claude Code usage"}
    )
    resp = client.post(
        f"/v1/spaces/{SEEDED_SPACE_ID}/folders", json={"name": "claude code usage"}
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "conflict"


def test_create_folder_rejects_a_too_short_name(client: TestClient) -> None:
    resp = client.post(
        f"/v1/spaces/{SEEDED_SPACE_ID}/folders", json={"name": "x"}
    )
    assert resp.status_code == 422


def test_create_folder_rejects_an_unowned_space(client: TestClient) -> None:
    resp = client.post(
        f"/v1/spaces/{OTHER_USER_SPACE_ID}/folders", json={"name": "Secret"}
    )
    assert resp.status_code == 404


def test_rename_and_delete_folder(client: TestClient) -> None:
    folder_id = client.post(
        f"/v1/spaces/{SEEDED_SPACE_ID}/folders", json={"name": "Drafts"}
    ).json()["id"]

    renamed = client.patch(
        f"/v1/spaces/{SEEDED_SPACE_ID}/folders/{folder_id}",
        json={"name": "Published"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Published"

    deleted = client.delete(f"/v1/spaces/{SEEDED_SPACE_ID}/folders/{folder_id}")
    assert deleted.status_code == 204
    listed = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/folders").json()
    assert listed["folders"] == []


def test_move_and_ungroup_a_capture(client: TestClient) -> None:
    source = _capture_article(client)
    assert source["folder_id"] is None

    folder_id = client.post(
        f"/v1/spaces/{SEEDED_SPACE_ID}/folders", json={"name": "Claude Code articles"}
    ).json()["id"]

    moved = client.patch(
        f"/v1/sources/{source['id']}/folder", json={"folder_id": folder_id}
    )
    assert moved.status_code == 200
    assert moved.json()["folder_id"] == folder_id

    listed = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/folders").json()
    assert listed["folders"][0]["source_count"] == 1

    ungrouped = client.patch(
        f"/v1/sources/{source['id']}/folder", json={"folder_id": None}
    )
    assert ungrouped.status_code == 200
    assert ungrouped.json()["folder_id"] is None


def test_deleting_a_folder_ungroups_its_captures(client: TestClient) -> None:
    source = _capture_article(client, title="Talk")
    folder_id = client.post(
        f"/v1/spaces/{SEEDED_SPACE_ID}/folders", json={"name": "Talks"}
    ).json()["id"]
    client.patch(f"/v1/sources/{source['id']}/folder", json={"folder_id": folder_id})

    client.delete(f"/v1/spaces/{SEEDED_SPACE_ID}/folders/{folder_id}")

    sources = client.get(f"/v1/spaces/{SEEDED_SPACE_ID}/sources").json()["sources"]
    assert sources[0]["folder_id"] is None


def test_cannot_move_a_source_into_another_spaces_folder(
    client: TestClient, space_repo: FakeSpaceRepo
) -> None:
    source = _capture_article(client)
    foreign = space_repo.create_folder(
        space_id=OTHER_USER_SPACE_ID,
        user_id=OTHER_USER_ID,
        name="Not yours",
    )
    resp = client.patch(
        f"/v1/sources/{source['id']}/folder", json={"folder_id": foreign["id"]}
    )
    assert resp.status_code == 404


def test_other_user_cannot_create_a_folder(
    space_repo: FakeSpaceRepo, collaborator_repo: FakeCollaboratorRepo
) -> None:
    svc = SpaceService(space_repo, collaborator_repo, FakeStorage())  # type: ignore[arg-type]
    other = User(id=UUID(OTHER_USER_ID), email="other@exomemri.com")
    with pytest.raises(NotFoundError):
        svc.create_folder(other, UUID(SEEDED_SPACE_ID), "Sneaky")
