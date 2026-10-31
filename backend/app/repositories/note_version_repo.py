"""Data access for the ``note_versions`` table (snapshots of space notes)."""

from __future__ import annotations

from supabase import Client

# Upper bound on rows removed by one prune pass; far above any realistic overflow.
_PRUNE_BATCH = 1000


class NoteVersionRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    def insert(
        self, *, note_id: str, user_id: str, title: str, content: dict, reason: str
    ) -> dict:
        row = {
            "note_id": note_id,
            "user_id": user_id,
            "title": title,
            "content": content,
            "reason": reason,
        }
        res = self._client.table("note_versions").insert(row).execute()
        return (res.data or [row])[0]

    def latest(self, *, note_id: str, user_id: str) -> dict | None:
        res = (
            self._client.table("note_versions")
            .select("*")
            .eq("note_id", note_id)
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None

    def list_summaries(self, *, note_id: str, user_id: str) -> list[dict]:
        res = (
            self._client.table("note_versions")
            .select("id,title,reason,created_at")
            .eq("note_id", note_id)
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        return res.data or []

    def get(self, *, note_id: str, version_id: str, user_id: str) -> dict | None:
        res = (
            self._client.table("note_versions")
            .select("*")
            .eq("id", version_id)
            .eq("note_id", note_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return res.data

    def prune(self, *, note_id: str, user_id: str, keep: int) -> int:
        """Delete all but the newest ``keep`` versions. Returns rows removed."""
        res = (
            self._client.table("note_versions")
            .select("id")
            .eq("note_id", note_id)
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(keep, keep + _PRUNE_BATCH - 1)
            .execute()
        )
        ids = [row["id"] for row in (res.data or [])]
        if not ids:
            return 0
        (
            self._client.table("note_versions")
            .delete()
            .in_("id", ids)
            .eq("user_id", user_id)
            .execute()
        )
        return len(ids)
