"""Data access for the ``source_collaborators`` table.

Separate from ``SpaceRepo`` for the same reason ``ConceptRepo`` is: a distinct
concern rather than more methods bolted onto the sources repo.
Uses the service-role client, so every query carries an explicit filter as its
authorization boundary.
"""

from __future__ import annotations

from supabase import Client


class CollaboratorRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    def add(self, *, source_id: str, space_id: str, user_id: str, invited_by: str) -> dict:
        """Insert a grant. Unique ``(source_id, user_id)`` is mapped to 409 above."""
        res = (
            self._client.table("source_collaborators")
            .insert(
                {
                    "source_id": source_id,
                    "space_id": space_id,
                    "user_id": user_id,
                    "invited_by": invited_by,
                }
            )
            .execute()
        )
        return res.data[0]

    def remove(self, *, source_id: str, user_id: str) -> None:
        self._client.table("source_collaborators").delete().eq("source_id", source_id).eq(
            "user_id", user_id
        ).execute()

    def is_collaborator(self, *, source_id: str, user_id: str) -> bool:
        res = (
            self._client.table("source_collaborators")
            .select("id")
            .eq("source_id", source_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return bool(res and res.data)

    def list_for_source(self, *, source_id: str) -> list[dict]:
        """Collaborators on one capture (profile fields resolved in the service)."""
        res = (
            self._client.table("source_collaborators")
            .select("*")
            .eq("source_id", source_id)
            .order("created_at")
            .execute()
        )
        return res.data or []

    def list_for_user(self, *, user_id: str) -> list[dict]:
        """Captures shared with this user, with the source and space joined."""
        res = (
            self._client.table("source_collaborators")
            .select(
                "*, sources(id, title, type, url, author, captured_at, "
                "processing_status, space_id, user_id), spaces(id, name)"
            )
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )
        return res.data or []
