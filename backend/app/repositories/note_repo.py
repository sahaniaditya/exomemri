"""Data access for the ``source_notes`` table (one notebook per capture)."""

from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client


class NoteRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    def get_by_source(self, *, source_id: str, user_id: str) -> dict | None:
        res = (
            self._client.table("source_notes")
            .select("*")
            .eq("source_id", source_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return res.data

    def upsert(
        self,
        *,
        source_id: str,
        user_id: str,
        space_id: str,
        content: dict,
    ) -> dict:
        row = {
            "source_id": source_id,
            "user_id": user_id,
            "space_id": space_id,
            "content": content,
            "updated_at": datetime.now(UTC).isoformat(),
        }
        res = (
            self._client.table("source_notes")
            .upsert(row, on_conflict="source_id")
            .execute()
        )
        return (res.data or [row])[0]
