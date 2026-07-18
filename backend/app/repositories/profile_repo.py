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

    def username_taken(self, username: str) -> bool:
        """Invoke the ``check_username_exists`` RPC; True if already claimed."""
        res = self._client.rpc(
            "check_username_exists", {"target_username": username}
        ).execute()
        return bool(res.data)

    def upsert_profile(self, row: dict) -> None:
        """Insert or overwrite the caller's profile row."""
        self._client.table("profiles").upsert(row).execute()
