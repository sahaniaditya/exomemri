"""Data access for the ``source_share_links`` table.

Uses the service-role client, so every query carries an explicit filter as its
authorization boundary. Active = ``revoked_at IS NULL``.
"""

from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client


class ShareLinkRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    def get_active_for_source(self, *, source_id: str) -> dict | None:
        res = (
            self._client.table("source_share_links")
            .select("*")
            .eq("source_id", source_id)
            .is_("revoked_at", "null")
            .maybe_single()
            .execute()
        )
        return res.data if res else None

    def get_active_by_token(self, *, token: str) -> dict | None:
        res = (
            self._client.table("source_share_links")
            .select("*")
            .eq("token", token)
            .is_("revoked_at", "null")
            .maybe_single()
            .execute()
        )
        return res.data if res else None

    def create(
        self, *, source_id: str, space_id: str, token: str, created_by: str
    ) -> dict:
        res = (
            self._client.table("source_share_links")
            .insert(
                {
                    "source_id": source_id,
                    "space_id": space_id,
                    "token": token,
                    "created_by": created_by,
                }
            )
            .execute()
        )
        return res.data[0]

    def revoke(self, *, source_id: str) -> None:
        """Mark the active link for this source revoked, if any."""
        self._client.table("source_share_links").update(
            {"revoked_at": datetime.now(UTC).isoformat()}
        ).eq("source_id", source_id).is_("revoked_at", "null").execute()
