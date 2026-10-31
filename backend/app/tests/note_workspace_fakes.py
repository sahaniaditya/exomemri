"""In-memory stand-ins for the notes workspace tables (shared store with FakeSpaceNoteRepo)."""

from __future__ import annotations

import re

from app.tests.conftest import FakeSpaceNoteRepo


class WorkspaceSpaceNoteRepo(FakeSpaceNoteRepo):
    """FakeSpaceNoteRepo that hides trashed pages like the real list query does."""

    def list_by_space(self, *, space_id: str, user_id: str) -> list[dict]:
        return [
            row
            for row in super().list_by_space(space_id=space_id, user_id=user_id)
            if not row.get("deleted_at")
        ]


def _words(text: str) -> set[str]:
    return set(re.findall(r"\w+", text.lower()))


class FakeNoteWorkspaceRepo:
    """Mirrors NoteWorkspaceRepo over the same ``notes`` dict as the space-note fake."""

    def __init__(self, notes: dict[str, dict]) -> None:
        self.notes = notes
        self.links: list[dict] = []
        self.sources: dict[str, dict] = {}
        self.fail_index = False

    def _mine(self, space_id: str, user_id: str) -> list[dict]:
        return [
            r for r in self.notes.values() if r["space_id"] == space_id and r["user_id"] == user_id
        ]

    @staticmethod
    def _order(row: dict) -> tuple:
        return (row["sort_order"], row.get("created_at") or "")

    def list_active(self, *, space_id: str, user_id: str) -> list[dict]:
        rows = [r for r in self._mine(space_id, user_id) if not r.get("deleted_at")]
        return sorted(rows, key=self._order)

    def list_trashed(self, *, space_id: str, user_id: str) -> list[dict]:
        rows = [r for r in self._mine(space_id, user_id) if r.get("deleted_at")]
        return sorted(rows, key=lambda r: r["deleted_at"], reverse=True)

    def get(self, *, space_id: str, note_id: str, user_id: str) -> dict | None:
        row = self.notes.get(note_id)
        if not row or row["space_id"] != space_id or row["user_id"] != user_id:
            return None
        return row

    def get_many(self, *, user_id: str, note_ids: list[str]) -> list[dict]:
        return [r for i in note_ids if (r := self.notes.get(i)) and r["user_id"] == user_id]

    def get_sources(self, *, user_id: str, source_ids: list[str]) -> list[dict]:
        return [
            s
            for i in source_ids
            if (s := self.sources.get(i)) and s["user_id"] == user_id
        ]

    def insert(self, row: dict) -> dict:
        from datetime import UTC, datetime

        now = datetime.now(UTC).isoformat()
        stored = {
            "icon": None,
            "cover_key": None,
            "full_width": False,
            "parent_id": None,
            "content_text": "",
            "deleted_at": None,
            **row,
            "created_at": now,
            "updated_at": now,
        }
        self.notes[stored["id"]] = stored
        return stored

    def update(
        self, *, space_id: str, note_id: str, user_id: str, patch: dict, touch: bool = True
    ) -> dict | None:
        from datetime import UTC, datetime

        row = self.get(space_id=space_id, note_id=note_id, user_id=user_id)
        if not row:
            return None
        row.update(patch)
        if touch:
            row["updated_at"] = datetime.now(UTC).isoformat()
        return row

    def set_content_text(self, *, note_id: str, user_id: str, text: str) -> None:
        if self.fail_index:
            raise RuntimeError("index boom")
        row = self.notes.get(note_id)
        if row and row["user_id"] == user_id:
            row["content_text"] = text

    def trash_tree(self, *, space_id: str, note_id: str, user_id: str, deleted_at: str) -> None:
        for row in self._mine(space_id, user_id):
            if (row["id"] == note_id or row.get("parent_id") == note_id) and not row.get(
                "deleted_at"
            ):
                row["deleted_at"] = deleted_at

    def restore_tree(
        self, *, space_id: str, note_id: str, user_id: str, deleted_at: str, to_root: bool
    ) -> None:
        for row in self._mine(space_id, user_id):
            if row["id"] == note_id:
                row["deleted_at"] = None
                if to_root:
                    row["parent_id"] = None
            elif row.get("parent_id") == note_id and row.get("deleted_at") == deleted_at:
                row["deleted_at"] = None

    def _cascade_delete(self, note_id: str) -> None:
        self.notes.pop(note_id, None)
        self.links = [link for link in self.links if link["note_id"] != note_id]
        for child in [r["id"] for r in self.notes.values() if r.get("parent_id") == note_id]:
            self._cascade_delete(child)

    def delete_trashed(self, *, space_id: str, note_id: str, user_id: str) -> bool:
        row = self.get(space_id=space_id, note_id=note_id, user_id=user_id)
        if not row or not row.get("deleted_at"):
            return False
        self._cascade_delete(note_id)
        return True

    def purge_trashed_before(self, *, space_id: str, user_id: str, cutoff: str) -> None:
        from datetime import datetime

        limit = datetime.fromisoformat(cutoff)
        for row in list(self._mine(space_id, user_id)):
            stamp = row.get("deleted_at")
            if stamp and datetime.fromisoformat(stamp) < limit:
                self._cascade_delete(row["id"])

    def search_fulltext(
        self, *, space_id: str, user_id: str, query: str, limit: int
    ) -> list[dict]:
        tokens = _words(query)
        scored = []
        for row in self.list_active(space_id=space_id, user_id=user_id):
            title_words = _words(row["title"])
            body_words = _words(row.get("content_text") or "")
            if tokens and tokens <= title_words | body_words:
                rank = 2 * len(tokens & title_words) + len(tokens & body_words)
                scored.append((rank, row))
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [row for _, row in scored][:limit]

    def search_partial(
        self, *, space_id: str, user_id: str, term: str, column: str, limit: int
    ) -> list[dict]:
        rows = [
            r
            for r in self.list_active(space_id=space_id, user_id=user_id)
            if term.lower() in (r.get(column) or "").lower()
        ]
        rows.sort(key=lambda r: r["updated_at"], reverse=True)
        return rows[:limit]

    def replace_links(self, *, note_id: str, user_id: str, links: list[tuple[str, str]]) -> None:
        self.links = [link for link in self.links if link["note_id"] != note_id]
        self.links += [
            {"note_id": note_id, "user_id": user_id, "target_type": kind, "target_id": target}
            for kind, target in links
        ]

    def list_outgoing_links(self, *, note_id: str, user_id: str) -> list[dict]:
        return [
            link
            for link in self.links
            if link["note_id"] == note_id and link["user_id"] == user_id
        ]

    def list_incoming_note_ids(self, *, note_id: str, user_id: str) -> list[str]:
        return [
            link["note_id"]
            for link in self.links
            if link["target_type"] == "note"
            and link["target_id"] == note_id
            and link["user_id"] == user_id
        ]
