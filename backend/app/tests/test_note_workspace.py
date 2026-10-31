"""Notes workspace API: tree, trash, search, patch, duplicate, export, links, indexing hook."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.dependencies import get_note_service, get_note_workspace_service, get_space_service
from app.repositories.storage_repo import get_storage_repo
from app.schemas.note_workspace import MAX_WORKSPACE_PAGES
from app.services.note_index_service import NoteIndexService
from app.services.note_service import NoteService
from app.services.note_workspace_service import NoteWorkspaceService
from app.tests.conftest import (
    OTHER_USER_SPACE_ID,
    SEEDED_SPACE_ID,
    FakeNoteRepo,
)
from app.tests.note_workspace_fakes import FakeNoteWorkspaceRepo, WorkspaceSpaceNoteRepo

SPACE = SEEDED_SPACE_ID
DEV_USER = "00000000-0000-0000-0000-0000000000a1"
OTHER_USER = "00000000-0000-0000-0000-0000000000ff"
BASE = f"/v1/spaces/{SPACE}/notes"


class Ctx:
    """Test handle bundling the HTTP client with the in-memory tables."""

    def __init__(self, client: TestClient, repo: FakeNoteWorkspaceRepo) -> None:
        self.client = client
        self.repo = repo

    def make(self, title: str = "Untitled", parent: str | None = None) -> dict:
        body: dict = {"title": title}
        if parent:
            body["parent_id"] = parent
        resp = self.client.post(f"{BASE}/pages", json=body)
        assert resp.status_code == 201, resp.text
        return resp.json()

    def patch(self, note_id: str, **body) -> object:
        return self.client.patch(f"{BASE}/{note_id}", json=body)

    def set_content(self, note_id: str, doc: dict) -> dict:
        resp = self.patch(note_id, content=doc)
        assert resp.status_code == 200, resp.text
        return resp.json()

    def tree(self) -> list[dict]:
        return self.client.get(f"{BASE}/tree").json()["items"]

    def add_source(self, title: str, owner: str = DEV_USER) -> str:
        source_id = str(uuid4())
        self.repo.sources[source_id] = {"id": source_id, "title": title, "user_id": owner}
        return source_id


@pytest.fixture
def ws(client: TestClient) -> Ctx:
    overrides = client.app.dependency_overrides
    space_svc = overrides[get_space_service]()
    old_note_svc = overrides[get_note_service]()
    space_notes = WorkspaceSpaceNoteRepo()
    repo = FakeNoteWorkspaceRepo(space_notes.notes)
    indexer = NoteIndexService(repo)  # type: ignore[arg-type]
    note_svc = NoteService(
        FakeNoteRepo(),  # type: ignore[arg-type]
        space_notes,  # type: ignore[arg-type]
        space_svc,
        overrides[get_storage_repo](),
        get_settings(),
        indexer,
    )
    assert old_note_svc is not None
    overrides[get_note_service] = lambda: note_svc
    overrides[get_note_workspace_service] = lambda: NoteWorkspaceService(
        space_svc, repo, indexer  # type: ignore[arg-type]
    )
    return Ctx(client, repo)


def para(*inline: dict) -> dict:
    return {"type": "paragraph", "content": list(inline)}


def text(value: str) -> dict:
    return {"type": "text", "text": value}


def doc_of(*blocks: dict) -> dict:
    return {"type": "doc", "content": list(blocks)}


def doc_with_text(value: str) -> dict:
    return doc_of(para(text(value)))


# ------------------------------------------------------------------ create / tree


def test_tree_is_empty_initially(ws: Ctx) -> None:
    assert ws.client.get(f"{BASE}/tree").json() == {"items": []}


def test_create_assigns_sort_order_per_parent(ws: Ctx) -> None:
    a = ws.make("A")
    b = ws.make("B")
    c1 = ws.make("A1", parent=a["id"])
    c2 = ws.make("A2", parent=a["id"])
    b1 = ws.make("B1", parent=b["id"])
    assert (a["sort_order"], b["sort_order"]) == (0, 1)
    assert (c1["sort_order"], c2["sort_order"], b1["sort_order"]) == (0, 1, 0)
    assert c1["parent_id"] == a["id"]
    assert b["parent_id"] is None
    assert b["full_width"] is False and b["icon"] is None and b["cover_key"] is None


def test_tree_shape_order_and_no_content(ws: Ctx) -> None:
    a = ws.make("A")
    b = ws.make("B")
    child = ws.make("Child", parent=a["id"])
    items = ws.tree()
    for item in items:
        assert set(item) == {"id", "title", "icon", "parent_id", "sort_order", "updated_at"}
    by_id = {i["id"]: i for i in items}
    assert by_id[child["id"]]["parent_id"] == a["id"]
    roots = [i["id"] for i in items if i["parent_id"] is None]
    assert roots == [a["id"], b["id"]]


def test_create_defaults_title(ws: Ctx) -> None:
    resp = ws.client.post(f"{BASE}/pages", json={})
    assert resp.status_code == 201
    assert resp.json()["title"] == "Untitled"
    assert resp.json()["content"]["type"] == "doc"


def test_create_rejects_blank_title(ws: Ctx) -> None:
    assert ws.client.post(f"{BASE}/pages", json={"title": "   "}).status_code == 422


def test_child_cannot_have_children(ws: Ctx) -> None:
    root = ws.make("Root")
    child = ws.make("Child", parent=root["id"])
    resp = ws.client.post(f"{BASE}/pages", json={"parent_id": child["id"]})
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "validation"


def test_unknown_parent_rejected(ws: Ctx) -> None:
    resp = ws.client.post(f"{BASE}/pages", json={"parent_id": str(uuid4())})
    assert resp.status_code == 422


def test_parent_from_another_space_rejected(ws: Ctx) -> None:
    foreign = str(uuid4())
    ws.repo.notes[foreign] = {
        "id": foreign,
        "space_id": OTHER_USER_SPACE_ID,
        "user_id": OTHER_USER,
        "title": "Foreign",
        "content": doc_of(),
        "sort_order": 0,
        "parent_id": None,
        "deleted_at": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    assert ws.client.post(f"{BASE}/pages", json={"parent_id": foreign}).status_code == 422


def test_trashed_parent_rejected(ws: Ctx) -> None:
    root = ws.make("Root")
    ws.client.post(f"{BASE}/{root['id']}/trash")
    assert ws.client.post(f"{BASE}/pages", json={"parent_id": root["id"]}).status_code == 422


def test_cap_is_500_not_50(ws: Ctx) -> None:
    for i in range(60):
        ws.repo.insert(
            {
                "id": str(uuid4()),
                "space_id": SPACE,
                "user_id": DEV_USER,
                "title": f"P{i}",
                "content": doc_of(),
                "sort_order": i,
            }
        )
    assert ws.client.post(f"{BASE}/pages", json={}).status_code == 201
    for i in range(60, MAX_WORKSPACE_PAGES):
        ws.repo.insert(
            {
                "id": str(uuid4()),
                "space_id": SPACE,
                "user_id": DEV_USER,
                "title": f"P{i}",
                "content": doc_of(),
                "sort_order": i,
            }
        )
    full = ws.client.post(f"{BASE}/pages", json={})
    assert full.status_code == 409
    assert full.json()["error"]["detail"] == {"max": MAX_WORKSPACE_PAGES}
    first = next(iter(ws.repo.notes))
    assert ws.client.post(f"{BASE}/{first}/duplicate").status_code == 409


def test_trashed_pages_do_not_count_toward_cap(ws: Ctx) -> None:
    page = ws.make("x")
    for i in range(MAX_WORKSPACE_PAGES - 1):
        ws.repo.insert(
            {
                "id": str(uuid4()),
                "space_id": SPACE,
                "user_id": DEV_USER,
                "title": f"P{i}",
                "content": doc_of(),
                "sort_order": i + 1,
            }
        )
    assert ws.client.post(f"{BASE}/pages", json={}).status_code == 409
    ws.client.post(f"{BASE}/{page['id']}/trash")
    assert ws.client.post(f"{BASE}/pages", json={}).status_code == 201


# ----------------------------------------------------------------------- get / patch


def test_get_page_returns_content_and_new_fields(ws: Ctx) -> None:
    page = ws.make("Hello")
    got = ws.client.get(f"{BASE}/{page['id']}").json()
    assert got["title"] == "Hello"
    assert got["space_id"] == SPACE
    assert got["content"]["type"] == "doc"
    for key in ("icon", "cover_key", "full_width", "parent_id", "sort_order", "updated_at"):
        assert key in got


def test_rename_icon_cover_full_width(ws: Ctx) -> None:
    page = ws.make("A")
    resp = ws.patch(
        page["id"],
        title="  Renamed ",
        icon="📘",
        cover_key="notes/images/6f1c2b3a-0000-4000-8000-000000000000.png",
        full_width=True,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Renamed"
    assert body["icon"] == "📘"
    assert body["cover_key"].startswith("notes/images/")
    assert body["full_width"] is True
    cleared = ws.patch(page["id"], icon=None, cover_key=None).json()
    assert cleared["icon"] is None and cleared["cover_key"] is None


def test_patch_rejects_bad_cover_key(ws: Ctx) -> None:
    page = ws.make("A")
    assert ws.patch(page["id"], cover_key="../../etc/passwd").status_code == 422


@pytest.mark.parametrize(
    "body",
    [{}, {"expected_updated_at": "2026-01-01T00:00:00+00:00"}, {"title": None}, {"content": None},
     {"full_width": None}, {"sort_order": -1}, {"title": "  "}, {"icon": "x" * 40}],
)
def test_patch_validation(ws: Ctx, body: dict) -> None:
    page = ws.make("A")
    assert ws.patch(page["id"], **body).status_code == 422


def test_patch_content_updates_text_and_links(ws: Ctx) -> None:
    page = ws.make("A")
    source = ws.add_source("Talk")
    ws.set_content(
        page["id"],
        doc_of(
            para(text("quantum entanglement")),
            {"type": "captureEmbed", "attrs": {"sourceId": source, "title": "Talk"}},
        ),
    )
    row = ws.repo.notes[page["id"]]
    assert row["content_text"] == "quantum entanglement\nTalk"
    assert ws.repo.links == [
        {"note_id": page["id"], "user_id": DEV_USER, "target_type": "source", "target_id": source}
    ]
    ws.set_content(page["id"], doc_with_text("nothing linked"))
    assert ws.repo.links == []


def test_self_mention_is_not_a_link(ws: Ctx) -> None:
    page = ws.make("A")
    ws.set_content(
        page["id"],
        doc_of(para({"type": "noteMention", "attrs": {"noteId": page["id"], "title": "A"}})),
    )
    assert ws.repo.links == []


def test_conflict_when_expected_updated_at_is_stale(ws: Ctx) -> None:
    page = ws.make("A")
    first = ws.patch(page["id"], title="B", expected_updated_at=page["updated_at"])
    assert first.status_code == 200
    stale = ws.patch(page["id"], title="C", expected_updated_at=page["updated_at"])
    assert stale.status_code == 409
    err = stale.json()["error"]
    assert err["code"] == "conflict"
    assert err["detail"]["code"] == "note_conflict"
    assert err["detail"]["updated_at"] == first.json()["updated_at"]
    assert ws.repo.notes[page["id"]]["title"] == "B"
    ok = ws.patch(page["id"], title="D", expected_updated_at=first.json()["updated_at"])
    assert ok.status_code == 200 and ok.json()["title"] == "D"


def test_conflict_accepts_equivalent_timestamp_format(ws: Ctx) -> None:
    page = ws.make("A")
    stamp = page["updated_at"].replace("+00:00", "Z")
    assert ws.patch(page["id"], title="B", expected_updated_at=stamp).status_code == 200


def test_conflict_with_garbage_expected_value(ws: Ctx) -> None:
    page = ws.make("A")
    assert ws.patch(page["id"], title="B", expected_updated_at="garbage").status_code == 409


def test_move_under_parent_appends_and_back_to_root(ws: Ctx) -> None:
    a = ws.make("A")
    b = ws.make("B")
    child = ws.make("C", parent=a["id"])
    moved = ws.patch(b["id"], parent_id=a["id"]).json()
    assert moved["parent_id"] == a["id"]
    assert moved["sort_order"] == child["sort_order"] + 1
    root_again = ws.patch(b["id"], parent_id=None).json()
    assert root_again["parent_id"] is None
    assert root_again["sort_order"] == a["sort_order"] + 1


def test_move_rejects_depth_self_and_page_with_children(ws: Ctx) -> None:
    a = ws.make("A")
    b = ws.make("B")
    child = ws.make("C", parent=a["id"])
    assert ws.patch(b["id"], parent_id=child["id"]).status_code == 422  # depth
    assert ws.patch(b["id"], parent_id=b["id"]).status_code == 422  # self
    assert ws.patch(a["id"], parent_id=b["id"]).status_code == 422  # a has children
    assert ws.repo.notes[a["id"]]["parent_id"] is None
    # Moving a child between parents is fine.
    assert ws.patch(child["id"], parent_id=b["id"]).status_code == 200


def test_reorder_sets_sort_order_without_bumping_updated_at(ws: Ctx) -> None:
    a = ws.make("A")
    b = ws.make("B")
    resp = ws.patch(b["id"], sort_order=0).json()
    assert resp["sort_order"] == 0
    assert resp["updated_at"] == b["updated_at"]
    assert ws.repo.notes[a["id"]]["updated_at"] == a["updated_at"]


def test_move_to_same_parent_is_a_noop(ws: Ctx) -> None:
    a = ws.make("A")
    child = ws.make("C", parent=a["id"])
    resp = ws.patch(child["id"], parent_id=a["id"])
    assert resp.status_code == 200
    assert resp.json()["sort_order"] == child["sort_order"]


def test_reorder_does_not_invalidate_an_open_editor(ws: Ctx) -> None:
    a = ws.make("A")
    ws.patch(a["id"], sort_order=5)
    assert ws.patch(a["id"], title="B", expected_updated_at=a["updated_at"]).status_code == 200


def test_content_change_bumps_updated_at(ws: Ctx) -> None:
    a = ws.make("A")
    updated = ws.set_content(a["id"], doc_with_text("x"))
    assert updated["updated_at"] != a["updated_at"]


# ------------------------------------------------------------------------ trash


def test_trash_cascades_to_children_and_hides_from_tree(ws: Ctx) -> None:
    a = ws.make("A")
    ws.make("A1", parent=a["id"])
    other = ws.make("Other")
    assert ws.client.post(f"{BASE}/{a['id']}/trash").status_code == 204
    assert [i["id"] for i in ws.tree()] == [other["id"]]
    trash = ws.client.get(f"{BASE}/trash").json()["items"]
    assert {t["title"] for t in trash} == {"A", "A1"}
    assert all(t["deleted_at"] for t in trash)
    assert ws.client.get(f"{BASE}/{a['id']}").status_code == 404


def test_trash_twice_and_unknown_are_404(ws: Ctx) -> None:
    a = ws.make("A")
    ws.client.post(f"{BASE}/{a['id']}/trash")
    assert ws.client.post(f"{BASE}/{a['id']}/trash").status_code == 404
    assert ws.client.post(f"{BASE}/{uuid4()}/trash").status_code == 404


def test_restore_brings_back_page_and_cotrashed_children(ws: Ctx) -> None:
    a = ws.make("A")
    c1 = ws.make("C1", parent=a["id"])
    c2 = ws.make("C2", parent=a["id"])
    ws.client.post(f"{BASE}/{c2['id']}/trash")  # trashed on its own earlier
    ws.client.post(f"{BASE}/{a['id']}/trash")
    restored = ws.client.post(f"{BASE}/{a['id']}/restore")
    assert restored.status_code == 200
    assert restored.json()["id"] == a["id"]
    live = {i["id"] for i in ws.tree()}
    assert live == {a["id"], c1["id"]}
    assert [t["id"] for t in ws.client.get(f"{BASE}/trash").json()["items"]] == [c2["id"]]


def test_restore_child_of_trashed_parent_goes_to_root(ws: Ctx) -> None:
    a = ws.make("A")
    c = ws.make("C", parent=a["id"])
    ws.client.post(f"{BASE}/{a['id']}/trash")
    resp = ws.client.post(f"{BASE}/{c['id']}/restore")
    assert resp.status_code == 200
    assert resp.json()["parent_id"] is None
    assert {i["id"] for i in ws.tree()} == {c["id"]}


def test_restore_child_with_live_parent_keeps_parent(ws: Ctx) -> None:
    a = ws.make("A")
    c = ws.make("C", parent=a["id"])
    ws.client.post(f"{BASE}/{c['id']}/trash")
    resp = ws.client.post(f"{BASE}/{c['id']}/restore")
    assert resp.json()["parent_id"] == a["id"]


def test_restore_live_page_is_404(ws: Ctx) -> None:
    a = ws.make("A")
    assert ws.client.post(f"{BASE}/{a['id']}/restore").status_code == 404


def test_lazy_purge_removes_pages_trashed_over_30_days(ws: Ctx) -> None:
    old = ws.make("Old")
    old_child = ws.make("OldChild", parent=old["id"])
    fresh = ws.make("Fresh")
    ws.client.post(f"{BASE}/{old['id']}/trash")
    ws.client.post(f"{BASE}/{fresh['id']}/trash")
    long_ago = (datetime.now(UTC) - timedelta(days=31)).isoformat()
    for note_id in (old["id"], old_child["id"]):
        ws.repo.notes[note_id]["deleted_at"] = long_ago
    items = ws.client.get(f"{BASE}/trash").json()["items"]
    assert [i["id"] for i in items] == [fresh["id"]]
    assert old["id"] not in ws.repo.notes and old_child["id"] not in ws.repo.notes


def test_page_trashed_29_days_ago_survives_purge(ws: Ctx) -> None:
    a = ws.make("A")
    ws.client.post(f"{BASE}/{a['id']}/trash")
    ws.repo.notes[a["id"]]["deleted_at"] = (datetime.now(UTC) - timedelta(days=29)).isoformat()
    assert len(ws.client.get(f"{BASE}/trash").json()["items"]) == 1


def test_permanent_delete_requires_trashed_page(ws: Ctx) -> None:
    a = ws.make("A")
    child = ws.make("C", parent=a["id"])
    assert ws.client.delete(f"{BASE}/trash/{a['id']}").status_code == 404
    assert a["id"] in ws.repo.notes
    ws.client.post(f"{BASE}/{a['id']}/trash")
    assert ws.client.delete(f"{BASE}/trash/{a['id']}").status_code == 204
    assert a["id"] not in ws.repo.notes and child["id"] not in ws.repo.notes
    assert ws.client.delete(f"{BASE}/trash/{a['id']}").status_code == 404


# --------------------------------------------------------------------- duplicate


def test_duplicate_copies_content_and_suffixes_title(ws: Ctx) -> None:
    root = ws.make("Root")
    page = ws.make("Original", parent=root["id"])
    source = ws.add_source("Vid")
    content = doc_of(
        para(text("body text")),
        {"type": "captureEmbed", "attrs": {"sourceId": source, "title": "Vid"}},
    )
    ws.set_content(page["id"], content)
    ws.patch(page["id"], icon="⭐", full_width=True)
    resp = ws.client.post(f"{BASE}/{page['id']}/duplicate")
    assert resp.status_code == 201
    copy = resp.json()
    assert copy["id"] != page["id"]
    assert copy["title"] == "Original (copy)"
    assert copy["content"] == content
    assert copy["icon"] == "⭐" and copy["full_width"] is True
    assert copy["parent_id"] == root["id"]
    assert copy["sort_order"] == page["sort_order"] + 1
    assert ws.repo.notes[copy["id"]]["content_text"] == "body text\nVid"
    assert any(
        link["note_id"] == copy["id"] and link["target_id"] == source
        for link in ws.repo.links
    )


def test_duplicate_truncates_long_titles(ws: Ctx) -> None:
    page = ws.make("x" * 120)
    copy = ws.client.post(f"{BASE}/{page['id']}/duplicate").json()
    assert len(copy["title"]) == 120
    assert copy["title"].endswith(" (copy)")


def test_duplicate_does_not_copy_children_and_skips_trashed(ws: Ctx) -> None:
    a = ws.make("A")
    ws.make("C", parent=a["id"])
    copy = ws.client.post(f"{BASE}/{a['id']}/duplicate").json()
    assert not [i for i in ws.tree() if i["parent_id"] == copy["id"]]
    ws.client.post(f"{BASE}/{a['id']}/trash")
    assert ws.client.post(f"{BASE}/{a['id']}/duplicate").status_code == 404


# ------------------------------------------------------------------------ search


def test_search_ranks_title_matches_before_body(ws: Ctx) -> None:
    body = ws.make("Misc")
    ws.set_content(body["id"], doc_with_text("notes on raft consensus"))
    title = ws.make("Raft consensus")
    other = ws.make("Unrelated")
    ws.set_content(other["id"], doc_with_text("nothing here"))
    hits = ws.client.get(f"{BASE}/search", params={"q": "raft consensus"}).json()["items"]
    assert [h["id"] for h in hits] == [title["id"], body["id"]]
    assert "raft consensus" in hits[1]["snippet"]
    assert set(hits[0]) == {"id", "title", "icon", "snippet"}


def test_search_falls_back_to_partial_terms(ws: Ctx) -> None:
    page = ws.make("Distributed architecture")
    body = ws.make("Other")
    ws.set_content(body["id"], doc_with_text("the microarchitecture of chips"))
    hits = ws.client.get(f"{BASE}/search", params={"q": "arch"}).json()["items"]
    ids = [h["id"] for h in hits]
    assert ids == [page["id"], body["id"]]  # title matches before body matches
    assert "microarchitecture" in hits[1]["snippet"]


def test_search_never_returns_trashed_or_foreign_pages(ws: Ctx) -> None:
    mine = ws.make("Secret plan")
    trashed = ws.make("Secret trashed")
    ws.client.post(f"{BASE}/{trashed['id']}/trash")
    ws.repo.notes["foreign"] = {
        "id": "foreign",
        "space_id": SPACE,
        "user_id": OTHER_USER,
        "title": "Secret of someone else",
        "content": doc_of(),
        "content_text": "secret",
        "sort_order": 0,
        "deleted_at": None,
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    hits = ws.client.get(f"{BASE}/search", params={"q": "secret"}).json()["items"]
    assert [h["id"] for h in hits] == [mine["id"]]


def test_search_is_capped_at_20(ws: Ctx) -> None:
    for i in range(25):
        ws.make(f"Match {i}")
    hits = ws.client.get(f"{BASE}/search", params={"q": "match"}).json()["items"]
    assert len(hits) == 20


def test_search_ilike_special_characters_are_literal(ws: Ctx) -> None:
    ws.make("100% sure")
    assert len(ws.client.get(f"{BASE}/search", params={"q": "100%"}).json()["items"]) == 1


@pytest.mark.parametrize("q", ["", "x" * 101])
def test_search_query_length_bounds(ws: Ctx, q: str) -> None:
    assert ws.client.get(f"{BASE}/search", params={"q": q}).status_code == 422


def test_search_requires_q(ws: Ctx) -> None:
    assert ws.client.get(f"{BASE}/search").status_code == 422


def test_search_blank_query_returns_nothing(ws: Ctx) -> None:
    ws.make("Anything")
    assert ws.client.get(f"{BASE}/search", params={"q": "   "}).json() == {"items": []}


# ------------------------------------------------------------------------ export


def test_export_markdown_response(ws: Ctx) -> None:
    page = ws.make("My Page!")
    ws.set_content(page["id"], doc_of(para(text("hello"))))
    resp = ws.client.get(f"{BASE}/{page['id']}/export.md")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/markdown")
    assert 'filename="my-page.md"' in resp.headers["content-disposition"]
    assert resp.text == "# My Page!\n\nhello\n"


def test_export_with_odd_title_and_unknown_nodes_does_not_fail(ws: Ctx) -> None:
    page = ws.make("日本語")
    ws.set_content(page["id"], doc_of({"type": "brandNewNode", "content": [text("still here")]}))
    resp = ws.client.get(f"{BASE}/{page['id']}/export.md")
    assert resp.status_code == 200
    assert 'filename="note.md"' in resp.headers["content-disposition"]
    assert "still here" in resp.text


def test_export_trashed_is_404(ws: Ctx) -> None:
    page = ws.make("A")
    ws.client.post(f"{BASE}/{page['id']}/trash")
    assert ws.client.get(f"{BASE}/{page['id']}/export.md").status_code == 404


# ------------------------------------------------------------------------- links


def test_links_resolve_and_drop_dead_targets(ws: Ctx) -> None:
    page = ws.make("Hub")
    live_note = ws.make("Live note")
    trashed_note = ws.make("Trashed note")
    ws.client.post(f"{BASE}/{trashed_note['id']}/trash")
    live_source = ws.add_source("Live capture")
    foreign_source = ws.add_source("Not mine", owner=OTHER_USER)
    dead_source = str(uuid4())
    ws.set_content(
        page["id"],
        doc_of(
            {"type": "captureEmbed", "attrs": {"sourceId": live_source, "title": "x"}},
            {"type": "captureEmbed", "attrs": {"sourceId": foreign_source, "title": "x"}},
            {"type": "captureEmbed", "attrs": {"sourceId": dead_source, "title": "x"}},
            para(
                {"type": "noteMention", "attrs": {"noteId": live_note["id"], "title": "x"}},
                {"type": "noteMention", "attrs": {"noteId": trashed_note["id"], "title": "x"}},
                {"type": "noteMention", "attrs": {"noteId": str(uuid4()), "title": "x"}},
            ),
        ),
    )
    assert len(ws.repo.links) == 6  # dead targets are stored, filtered on read
    body = ws.client.get(f"{BASE}/{page['id']}/links").json()
    assert body["outgoing"] == [
        {"type": "note", "id": live_note["id"], "title": "Live note"},
        {"type": "source", "id": live_source, "title": "Live capture"},
    ]
    assert body["incoming"] == []


def test_links_incoming_mentions(ws: Ctx) -> None:
    target = ws.make("Target")
    a = ws.make("Alpha")
    b = ws.make("Beta")
    gone = ws.make("Gone")
    mention = {"type": "noteMention", "attrs": {"noteId": target["id"], "title": "Target"}}
    for note in (a, b, gone):
        ws.set_content(note["id"], doc_of(para(mention)))
    ws.client.post(f"{BASE}/{gone['id']}/trash")
    ws.patch(a["id"], icon="🅰")
    body = ws.client.get(f"{BASE}/{target['id']}/links").json()
    assert body["incoming"] == [
        {"id": a["id"], "title": "Alpha", "icon": "🅰"},
        {"id": b["id"], "title": "Beta", "icon": None},
    ]
    assert body["outgoing"] == []


def test_links_of_unknown_page_is_404(ws: Ctx) -> None:
    assert ws.client.get(f"{BASE}/{uuid4()}/links").status_code == 404


# ------------------------------------------------------------- ownership / authz


def _routes(note_id: str) -> list[tuple[str, str, dict | None]]:
    return [
        ("get", "/tree", None),
        ("get", "/trash", None),
        ("get", "/search?q=a", None),
        ("post", "/pages", {}),
        ("get", f"/{note_id}", None),
        ("patch", f"/{note_id}", {"title": "x"}),
        ("post", f"/{note_id}/trash", None),
        ("post", f"/{note_id}/restore", None),
        ("post", f"/{note_id}/duplicate", None),
        ("delete", f"/trash/{note_id}", None),
        ("get", f"/{note_id}/export.md", None),
        ("get", f"/{note_id}/links", None),
    ]


@pytest.mark.parametrize("index", range(12))
def test_every_route_rejects_a_space_the_user_does_not_own(ws: Ctx, index: int) -> None:
    page = ws.make("Mine")
    method, path, body = _routes(page["id"])[index]
    url = f"/v1/spaces/{OTHER_USER_SPACE_ID}/notes{path}"
    resp = ws.client.request(method.upper(), url, json=body)
    assert resp.status_code == 404, (method, path, resp.text)
    assert resp.json()["error"]["code"] == "not_found"
    assert ws.repo.notes[page["id"]]["title"] == "Mine"


def test_page_of_another_user_is_not_reachable_through_my_space(ws: Ctx) -> None:
    foreign = str(uuid4())
    ws.repo.notes[foreign] = {
        "id": foreign,
        "space_id": SPACE,
        "user_id": OTHER_USER,
        "title": "Theirs",
        "content": doc_of(),
        "sort_order": 0,
        "deleted_at": None,
        "created_at": "2026-01-01T00:00:00+00:00",
        "updated_at": "2026-01-01T00:00:00+00:00",
    }
    for method, path, body in _routes(foreign):
        if path in {"/tree", "/trash", "/pages"} or path.startswith("/search"):
            continue
        resp = ws.client.request(method.upper(), f"{BASE}{path}", json=body)
        assert resp.status_code == 404, (method, path)
    assert ws.repo.notes[foreign]["title"] == "Theirs"


def test_invalid_uuid_path_is_422(ws: Ctx) -> None:
    assert ws.client.get(f"{BASE}/not-a-uuid").status_code == 422


# ------------------------------------------------- legacy endpoints + indexing hook


def test_legacy_put_refreshes_content_text_and_links(ws: Ctx) -> None:
    created = ws.client.post(BASE, json={"title": "Legacy"}).json()
    source = ws.add_source("Cap")
    content = doc_of(
        para(text("saved via old PUT")),
        {"type": "captureEmbed", "attrs": {"sourceId": source, "title": "Cap"}},
    )
    put = ws.client.put(f"{BASE}/{created['id']}", json={"content": content})
    assert put.status_code == 200
    assert put.json()["content"] == content
    assert ws.repo.notes[created["id"]]["content_text"] == "saved via old PUT\nCap"
    assert [link["target_id"] for link in ws.repo.links] == [source]
    hits = ws.client.get(f"{BASE}/search", params={"q": "saved"}).json()["items"]
    assert [h["id"] for h in hits] == [created["id"]]


def test_legacy_rename_only_does_not_touch_index(ws: Ctx) -> None:
    created = ws.client.post(BASE, json={}).json()
    ws.client.put(f"{BASE}/{created['id']}", json={"content": doc_with_text("keep")})
    ws.client.put(f"{BASE}/{created['id']}", json={"title": "New"})
    assert ws.repo.notes[created["id"]]["content_text"] == "keep"


def test_indexing_failure_never_fails_the_save(ws: Ctx) -> None:
    created = ws.client.post(BASE, json={}).json()
    ws.repo.fail_index = True
    put = ws.client.put(f"{BASE}/{created['id']}", json={"content": doc_with_text("survives")})
    assert put.status_code == 200
    assert put.json()["content"] == doc_with_text("survives")
    patched = ws.patch(created["id"], content=doc_with_text("also survives"))
    assert patched.status_code == 200
    ws.repo.fail_index = False


def test_legacy_list_hides_trashed_and_keeps_shape(ws: Ctx) -> None:
    a = ws.make("A")
    b = ws.make("B")
    ws.client.post(f"{BASE}/{b['id']}/trash")
    items = ws.client.get(BASE).json()["items"]
    assert [i["id"] for i in items] == [a["id"]]
    assert set(items[0]) == {"id", "space_id", "title", "content", "sort_order", "updated_at"}


def test_legacy_create_and_delete_still_work(ws: Ctx) -> None:
    created = ws.client.post(BASE, json={"title": "Old style"})
    assert created.status_code == 201
    note_id = created.json()["id"]
    assert ws.client.delete(f"{BASE}/{note_id}").status_code == 204
    assert note_id not in ws.repo.notes


def test_note_service_without_indexer_still_saves(client: TestClient) -> None:
    """The default wiring in conftest has no indexer; the old path must be unaffected."""
    created = client.post(BASE, json={}).json()
    put = client.put(f"{BASE}/{created['id']}", json={"content": doc_with_text("x")})
    assert put.status_code == 200
