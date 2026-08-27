"""Data access for the ``source_notes`` table (named pages per capture)."""

from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client


class NoteRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    def list_by_source(self, *, source_id: str, user_id: str) -> list[dict]:
        res = (
            self._client.table("source_notes")
            .select("*")
            .eq("source_id", source_id)
            .eq("user_id", user_id)
            .order("sort_order")
            .order("created_at")
            .execute()
        )
        return res.data or []

    def get(self, *, source_id: str, note_id: str, user_id: str) -> dict | None:
        res = (
            self._client.table("source_notes")
            .select("*")
            .eq("id", note_id)
            .eq("source_id", source_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return res.data

    def insert(
        self,
        *,
        note_id: str,
        source_id: str,
        user_id: str,
        space_id: str,
        title: str,
        content: dict,
        sort_order: int,
    ) -> dict:
        now = datetime.now(UTC).isoformat()
        row = {
            "id": note_id,
            "source_id": source_id,
            "user_id": user_id,
            "space_id": space_id,
            "title": title,
            "content": content,
            "sort_order": sort_order,
            "created_at": now,
            "updated_at": now,
        }
        res = self._client.table("source_notes").insert(row).execute()
        return (res.data or [row])[0]

    def update(
        self,
        *,
        source_id: str,
        note_id: str,
        user_id: str,
        title: str | None = None,
        content: dict | None = None,
    ) -> dict | None:
        patch: dict = {"updated_at": datetime.now(UTC).isoformat()}
        if title is not None:
            patch["title"] = title
        if content is not None:
            patch["content"] = content
        res = (
            self._client.table("source_notes")
            .update(patch)
            .eq("id", note_id)
            .eq("source_id", source_id)
            .eq("user_id", user_id)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None

    def delete(self, *, source_id: str, note_id: str, user_id: str) -> bool:
        res = (
            self._client.table("source_notes")
            .delete()
            .eq("id", note_id)
            .eq("source_id", source_id)
            .eq("user_id", user_id)
            .execute()
        )
        return bool(res.data)
