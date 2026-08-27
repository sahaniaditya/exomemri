"""Data access for the ``profile_settings`` table.

Separate from ``ProfileRepo`` for the same reason ``CoverageRepo`` is: a
distinct concern rather than another column bolted onto an already-large
table. Uses the service-role client, so every query carries an explicit
filter as its authorization boundary.
"""

from __future__ import annotations

from supabase import Client


class ProfileSettingsRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    def get(self, *, user_id: str) -> dict | None:
        res = (
            self._client.table("profile_settings")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return res.data if res else None

    def upsert(self, *, user_id: str, profile_public: bool) -> None:
        self._client.table("profile_settings").upsert(
            {"user_id": user_id, "profile_public": profile_public}, on_conflict="user_id"
        ).execute()
