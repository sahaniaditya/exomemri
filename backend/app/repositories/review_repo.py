"""Data access for the ``product_reviews`` table."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from supabase import Client


class ReviewRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    def get_by_user(self, *, user_id: str) -> dict | None:
        res = (
            self._client.table("product_reviews")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return res.data if res else None

    def upsert(self, *, user_id: str, rating: int, body: str) -> dict:
        now = datetime.now(UTC).isoformat()
        existing = self.get_by_user(user_id=user_id)
        row = {
            "id": existing["id"] if existing else str(uuid4()),
            "user_id": user_id,
            "rating": rating,
            "body": body,
            "updated_at": now,
        }
        if not existing:
            row["created_at"] = now
        res = (
            self._client.table("product_reviews")
            .upsert(row, on_conflict="user_id")
            .execute()
        )
        return (res.data or [row])[0]

    def list_top_by_rating(self, *, limit: int) -> list[dict]:
        """Highest-rated reviews with profile attribution for the landing page."""
        res = (
            self._client.table("product_reviews")
            .select("id, rating, body, updated_at, profiles(full_name, primary_role)")
            .order("rating", desc=True)
            .order("updated_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []
