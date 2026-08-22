"""Data access for the ``space_coverage`` table.

Separate from ``SpaceRepo`` for the same reason ``ConceptRepo``/``ReviewRepo``
are: a distinct concern rather than more columns bolted onto ``spaces``. Uses
the service-role client, so every query carries an explicit ``user_id`` filter
as its authorization boundary.
"""

from __future__ import annotations

from supabase import Client


class CoverageRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    def get(self, *, space_id: str) -> dict | None:
        res = (
            self._client.table("space_coverage")
            .select("*")
            .eq("space_id", space_id)
            .maybe_single()
            .execute()
        )
        return res.data if res else None

    def upsert(
        self,
        *,
        space_id: str,
        user_id: str,
        coverage_pct: int | None,
        topics: list[dict],
        concept_count: int,
        generated_at: str | None,
    ) -> None:
        self._client.table("space_coverage").upsert(
            {
                "space_id": space_id,
                "user_id": user_id,
                "coverage_pct": coverage_pct,
                "syllabus_topics": topics,
                "syllabus_concept_count": concept_count,
                "generated_at": generated_at,
            },
            on_conflict="space_id",
        ).execute()
