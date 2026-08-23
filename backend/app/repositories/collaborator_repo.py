"""Data access for the ``space_collaborators`` table.

Separate from ``SpaceRepo`` for the same reason ``ConceptRepo``/``ReviewRepo``
are: a distinct concern rather than more methods bolted onto the sources repo.
Uses the service-role client, so every query carries an explicit filter as its
authorization boundary.
"""

from __future__ import annotations

from supabase import Client


class CollaboratorRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    def add(self, *, space_id: str, user_id: str, invited_by: str) -> dict:
        """Insert a grant, or return the existing one if already shared.

        Conflict target is ``space_collaborators_space_user_idx`` — inviting
        the same person twice is a no-op, not a duplicate row.
        """
        res = (
            self._client.table("space_collaborators")
            .upsert(
                {"space_id": space_id, "user_id": user_id, "invited_by": invited_by},
                on_conflict="space_id,user_id",
                ignore_duplicates=False,
            )
            .execute()
        )
        return res.data[0]

    def remove(self, *, space_id: str, user_id: str) -> None:
        self._client.table("space_collaborators").delete().eq("space_id", space_id).eq(
            "user_id", user_id
        ).execute()

    def is_collaborator(self, *, space_id: str, user_id: str) -> bool:
        res = (
            self._client.table("space_collaborators")
            .select("id")
            .eq("space_id", space_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return bool(res and res.data)

    def list_for_space(self, *, space_id: str) -> list[dict]:
        """Collaborators on one space (profile fields resolved in the service)."""
        res = (
            self._client.table("space_collaborators")
            .select("*")
            .eq("space_id", space_id)
            .order("created_at")
            .execute()
        )
        return res.data or []

    def list_for_user(self, *, user_id: str) -> list[dict]:
        """Spaces shared with this user, with the space and owner joined."""
        res = (
            self._client.table("space_collaborators")
            .select("*, spaces(id, name, slug, user_id)")
            .eq("user_id", user_id)
            .order("created_at")
            .execute()
        )
        return res.data or []
