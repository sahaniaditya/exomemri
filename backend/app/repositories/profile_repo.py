"""Data access for the ``profiles`` table and username RPCs.

Uses the service-role client. Repositories are the only layer that touches
the Supabase SDK; services orchestrate and map errors.
"""

from __future__ import annotations

import logging

from supabase import Client

logger = logging.getLogger(__name__)


class ProfileRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    def get_profile(self, user_id: str) -> dict | None:
        """Return the full profile row for ``user_id``, or ``None`` if absent."""
        res = (
            self._client.table("profiles")
            .select("*")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        return res.data if res else None

    def get_by_username(self, username: str) -> dict | None:
        """Return the profile row for ``username``, or ``None`` if no such user."""
        res = (
            self._client.table("profiles")
            .select("*")
            .eq("username", username)
            .maybe_single()
            .execute()
        )
        return res.data if res else None

    def username_taken(self, username: str) -> bool:
        """Invoke the ``check_username_exists`` RPC; True if already claimed."""
        res = self._client.rpc(
            "check_username_exists", {"target_username": username}
        ).execute()
        return bool(res.data)

    def upsert_profile(self, row: dict) -> None:
        """Insert or overwrite the caller's profile row."""
        self._client.table("profiles").upsert(row).execute()

    def update_streak(
        self, *, user_id: str, current_streak: int, longest_streak: int, last_active_date: str
    ) -> None:
        self._client.table("profiles").update(
            {
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "last_active_date": last_active_date,
            }
        ).eq("id", user_id).execute()
