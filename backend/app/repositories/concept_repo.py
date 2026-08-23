"""Data access for the ``concepts`` / ``source_concepts`` tables (the knowledge map).

Separate from ``SpaceRepo`` for the same reason ``ChunkRepo`` is: a distinct
concern (concept canonicalization + graph reads) rather than more methods bolted
onto the sources repo. Uses the service-role client, so every query carries an
explicit ``user_id``/``space_id`` filter as its authorization boundary.
"""

from __future__ import annotations

from supabase import Client


class ConceptRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    def list_labels(self, *, space_id: str) -> list[str]:
        """Existing concept labels in a space — the extraction prompt's vocabulary.

        Feeding these back to the model is what stops "load balancer" and "load
        balancing" forking into two nodes; the unique index on
        ``(space_id, slug)`` is the backstop when it does.
        """
        res = (
            self._client.table("concepts")
            .select("label")
            .eq("space_id", space_id)
            .execute()
        )
        return [row["label"] for row in (res.data or [])]

    def upsert_concepts(self, rows: list[dict]) -> list[dict]:
        """Insert concepts, merging onto the existing row when the slug repeats.

        Conflict target is the ``concepts_space_slug_idx`` unique index, so a
        concept a second source also mentions resolves to the same id rather
        than duplicating.
        """
        if not rows:
            return []
        res = (
            self._client.table("concepts")
            .upsert(rows, on_conflict="space_id,slug", ignore_duplicates=False)
            .execute()
        )
        return res.data or []

    def replace_source_concepts(self, *, source_id: str, edges: list[dict]) -> None:
        """Delete-then-insert, mirroring ``ChunkRepo.replace_chunks``.

        Re-extracting a source must not leave stale edges alongside fresh ones.
        """
        self._client.table("source_concepts").delete().eq("source_id", source_id).execute()
        if edges:
            self._client.table("source_concepts").insert(edges).execute()

    def get_space_graph(self, *, user_id: str, space_id: str) -> dict:
        """Nodes, edges and pending count in one round trip (see the RPC)."""
        res = self._client.rpc(
            "get_space_graph", {"target_user": user_id, "target_space": space_id}
        ).execute()
        rows = res.data or []
        if not rows:
            return {"concepts": [], "sources": [], "edges": [], "pending": 0}
        return rows[0]

    def delete_orphan_concepts(self, *, space_id: str) -> None:
        """Drop concepts in a space that no source references any more.

        Re-extraction can strand a concept whose only source stopped mentioning
        it; without this the map accumulates nodes with degree 0.
        """
        self._client.rpc("delete_orphan_concepts", {"target_space": space_id}).execute()
