"""Data access for the ``review_items`` table (the daily review queue).

Separate from ``SpaceRepo`` for the same reason ``ConceptRepo`` is: a distinct
concern rather than more methods bolted onto the sources repo. Uses the
service-role client, so every query carries an explicit ``user_id``/``space_id``
filter as its authorization boundary.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from supabase import Client


class ReviewRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    def replace_source_items(
        self, *, source_id: str, space_id: str, user_id: str, prompts: list[str]
    ) -> None:
        """Delete-then-insert, mirroring ``ConceptRepo.replace_source_concepts``.

        Re-summarizing a source must not leave stale items alongside fresh
        ones — old prompt text that's no longer in the summary is dropped
        along with any review history attached to it.
        """
        self._client.table("review_items").delete().eq("source_id", source_id).execute()
        if prompts:
            rows = [
                {
                    "source_id": source_id,
                    "space_id": space_id,
                    "user_id": user_id,
                    "prompt_text": prompt,
                }
                for prompt in prompts
            ]
            self._client.table("review_items").insert(rows).execute()

    def _stale_cutoff(self, staleness_days: int) -> str:
        return (datetime.now(UTC) - timedelta(days=staleness_days)).isoformat()

    def list_due(
        self, *, space_id: str, user_id: str, staleness_days: int, limit: int
    ) -> list[dict]:
        """Due items — never reviewed, or last reviewed before the cutoff.

        Never-reviewed rows sort first (``NULLS FIRST`` is Postgres's default
        ascending-order behavior), then oldest-reviewed-first, so a queue
        repeatedly called makes monotonic progress through the backlog.
        """
        cutoff = self._stale_cutoff(staleness_days)
        res = (
            self._client.table("review_items")
            .select("*, sources(title)")
            .eq("space_id", space_id)
            .eq("user_id", user_id)
            .or_(f"last_reviewed_at.is.null,last_reviewed_at.lt.{cutoff}")
            .order("last_reviewed_at")
            .limit(limit)
            .execute()
        )
        return res.data or []

    def count_due(self, *, space_id: str, user_id: str, staleness_days: int) -> int:
        cutoff = self._stale_cutoff(staleness_days)
        res = (
            self._client.table("review_items")
            .select("id", count="exact")
            .eq("space_id", space_id)
            .eq("user_id", user_id)
            .or_(f"last_reviewed_at.is.null,last_reviewed_at.lt.{cutoff}")
            .execute()
        )
        return res.count or 0

    def mark_reviewed(self, *, item_id: str, space_id: str, user_id: str) -> dict | None:
        res = (
            self._client.table("review_items")
            .update({"last_reviewed_at": datetime.now(UTC).isoformat()})
            .eq("id", item_id)
            .eq("space_id", space_id)
            .eq("user_id", user_id)
            .select("*, sources(title)")
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None
