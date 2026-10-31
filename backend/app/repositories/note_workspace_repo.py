"""Data access for the notes workspace: tree, trash, search and ``note_links``.

Operates on the same ``space_notes`` table as ``SpaceNoteRepo``; every query is
scoped by ``user_id`` because the service-role client bypasses RLS.
"""

from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

_TREE_COLUMNS = "id,title,icon,parent_id,sort_order,created_at,updated_at,deleted_at"
_SEARCH_COLUMNS = "id,title,icon,content_text,updated_at"
SEARCHABLE_COLUMNS = frozenset({"title", "content_text"})


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class NoteWorkspaceRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    def _notes(self):  # noqa: ANN202 - supabase query builder type is private
        return self._client.table("space_notes")

    # --- reads -------------------------------------------------------------

    def list_active(self, *, space_id: str, user_id: str) -> list[dict]:
        res = (
            self._notes()
            .select(_TREE_COLUMNS)
            .eq("space_id", space_id)
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .order("sort_order")
            .order("created_at")
            .execute()
        )
        return res.data or []

    def list_trashed(self, *, space_id: str, user_id: str) -> list[dict]:
        res = (
            self._notes()
            .select(_TREE_COLUMNS)
            .eq("space_id", space_id)
            .eq("user_id", user_id)
            .not_.is_("deleted_at", "null")
            .order("deleted_at", desc=True)
            .execute()
        )
        return res.data or []

    def get(self, *, space_id: str, note_id: str, user_id: str) -> dict | None:
        res = (
            self._notes()
            .select("*")
            .eq("id", note_id)
            .eq("space_id", space_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return res.data if res else None

    def get_many(self, *, user_id: str, note_ids: list[str]) -> list[dict]:
        if not note_ids:
            return []
        res = (
            self._notes()
            .select("id,space_id,title,icon,deleted_at")
            .eq("user_id", user_id)
            .in_("id", note_ids)
            .execute()
        )
        return res.data or []

    def get_sources(self, *, user_id: str, source_ids: list[str]) -> list[dict]:
        if not source_ids:
            return []
        res = (
            self._client.table("sources")
            .select("id,title")
            .eq("user_id", user_id)
            .in_("id", source_ids)
            .execute()
        )
        return res.data or []

    # --- writes ------------------------------------------------------------

    def insert(self, row: dict) -> dict:
        now = datetime.now(UTC).isoformat()
        payload = {**row, "created_at": now, "updated_at": now}
        res = self._notes().insert(payload).execute()
        return (res.data or [payload])[0]

    def update(
        self,
        *,
        space_id: str,
        note_id: str,
        user_id: str,
        patch: dict,
        touch: bool = True,
    ) -> dict | None:
        """Apply ``patch``; ``touch`` bumps ``updated_at`` (the conflict token)."""
        values = dict(patch)
        if touch:
            values["updated_at"] = datetime.now(UTC).isoformat()
        res = (
            self._notes()
            .update(values)
            .eq("id", note_id)
            .eq("space_id", space_id)
            .eq("user_id", user_id)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None

    def set_content_text(self, *, note_id: str, user_id: str, text: str) -> None:
        """Refresh the search text without touching ``updated_at``."""
        (
            self._notes()
            .update({"content_text": text})
            .eq("id", note_id)
            .eq("user_id", user_id)
            .execute()
        )

    def trash_tree(self, *, space_id: str, note_id: str, user_id: str, deleted_at: str) -> None:
        """Trash a page and its live children with one shared timestamp."""
        for column, value in (("id", note_id), ("parent_id", note_id)):
            (
                self._notes()
                .update({"deleted_at": deleted_at})
                .eq(column, value)
                .eq("space_id", space_id)
                .eq("user_id", user_id)
                .is_("deleted_at", "null")
                .execute()
            )

    def restore_tree(
        self, *, space_id: str, note_id: str, user_id: str, deleted_at: str, to_root: bool
    ) -> None:
        """Restore a page and the children trashed with it (same timestamp)."""
        own: dict = {"deleted_at": None}
        if to_root:
            own["parent_id"] = None
        (
            self._notes()
            .update(own)
            .eq("id", note_id)
            .eq("space_id", space_id)
            .eq("user_id", user_id)
            .execute()
        )
        (
            self._notes()
            .update({"deleted_at": None})
            .eq("parent_id", note_id)
            .eq("space_id", space_id)
            .eq("user_id", user_id)
            .eq("deleted_at", deleted_at)
            .execute()
        )

    def delete_trashed(self, *, space_id: str, note_id: str, user_id: str) -> bool:
        res = (
            self._notes()
            .delete()
            .eq("id", note_id)
            .eq("space_id", space_id)
            .eq("user_id", user_id)
            .not_.is_("deleted_at", "null")
            .execute()
        )
        return bool(res.data)

    def purge_trashed_before(self, *, space_id: str, user_id: str, cutoff: str) -> None:
        (
            self._notes()
            .delete()
            .eq("space_id", space_id)
            .eq("user_id", user_id)
            .lt("deleted_at", cutoff)
            .execute()
        )

    # --- search ------------------------------------------------------------

    def search_fulltext(
        self, *, space_id: str, user_id: str, query: str, limit: int
    ) -> list[dict]:
        res = self._client.rpc(
            "search_space_notes",
            {"p_space_id": space_id, "p_user_id": user_id, "p_query": query, "p_limit": limit},
        ).execute()
        return res.data or []

    def search_partial(
        self, *, space_id: str, user_id: str, term: str, column: str, limit: int
    ) -> list[dict]:
        if column not in SEARCHABLE_COLUMNS:
            raise ValueError(f"Unsupported search column: {column}")
        res = (
            self._notes()
            .select(_SEARCH_COLUMNS)
            .eq("space_id", space_id)
            .eq("user_id", user_id)
            .is_("deleted_at", "null")
            .ilike(column, f"%{_escape_like(term)}%")
            .order("updated_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []

    # --- links -------------------------------------------------------------

    def replace_links(
        self, *, note_id: str, user_id: str, links: list[tuple[str, str]]
    ) -> None:
        self._client.table("note_links").delete().eq("note_id", note_id).execute()
        if links:
            rows = [
                {"note_id": note_id, "user_id": user_id, "target_type": kind, "target_id": target}
                for kind, target in links
            ]
            self._client.table("note_links").insert(rows).execute()

    def list_outgoing_links(self, *, note_id: str, user_id: str) -> list[dict]:
        res = (
            self._client.table("note_links")
            .select("target_type,target_id")
            .eq("note_id", note_id)
            .eq("user_id", user_id)
            .execute()
        )
        return res.data or []

    def list_incoming_note_ids(self, *, note_id: str, user_id: str) -> list[str]:
        res = (
            self._client.table("note_links")
            .select("note_id")
            .eq("target_type", "note")
            .eq("target_id", note_id)
            .eq("user_id", user_id)
            .execute()
        )
        return [str(row["note_id"]) for row in (res.data or [])]
