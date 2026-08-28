"""Data access for the ``source_chunks`` table (pgvector-backed RAG store).

Separate from ``SpaceRepo``: a distinct table/concern (chunk storage +
similarity search) rather than another method bolted onto the sources repo.
Uses the service-role client, so every query carries an explicit
``user_id``/``source_id`` filter as its authorization boundary.
"""

from __future__ import annotations

from supabase import Client

# PostgREST payload limits bite when each row carries a 384-d embedding.
# Insert in slices so a long document's chunks still land reliably.
INSERT_BATCH_SIZE = 100


class ChunkRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    def replace_chunks(self, *, source_id: str, chunks: list[dict]) -> None:
        """Delete-then-insert: reprocessing must not leave stale chunks

        alongside fresh ones (e.g. a retry after a source was re-captured).
        """
        self._client.table("source_chunks").delete().eq("source_id", source_id).execute()
        for start in range(0, len(chunks), INSERT_BATCH_SIZE):
            batch = chunks[start : start + INSERT_BATCH_SIZE]
            self._client.table("source_chunks").insert(batch).execute()

    def search(
        self, *, source_id: str, user_id: str, query_embedding: list[float], k: int = 6
    ) -> list[dict]:
        res = self._client.rpc(
            "match_source_chunks",
            {
                "target_source_id": source_id,
                "target_user_id": user_id,
                "query_embedding": query_embedding,
                "match_count": k,
            },
        ).execute()
        return res.data or []
