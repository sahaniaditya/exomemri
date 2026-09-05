"""Data access for the ``spaces`` and ``sources`` tables.

Uses the service-role client, which bypasses RLS — so every read and write here
carries an explicit ``user_id`` filter. That filter is the authorization
boundary for Learning Spaces; nothing above this layer may query without it.
"""

from __future__ import annotations

import logging

from supabase import Client

logger = logging.getLogger(__name__)


class SpaceRepo:
    def __init__(self, client: Client) -> None:
        self._client = client

    # --- spaces ---

    def create_space(
        self, *, user_id: str, name: str, slug: str, goal_text: str | None
    ) -> dict:
        """Insert a space and return the created row."""
        res = (
            self._client.table("spaces")
            .insert(
                {
                    "user_id": user_id,
                    "name": name,
                    "slug": slug,
                    "goal_text": goal_text,
                }
            )
            .execute()
        )
        return res.data[0]

    def list_spaces(self, user_id: str) -> list[dict]:
        """Spaces plus per-type source counts, newest activity first."""
        res = self._client.rpc(
            "list_spaces_with_counts", {"target_user": user_id}
        ).execute()
        return res.data or []

    def get_space(self, *, user_id: str, space_id: str) -> dict | None:
        """Return the space only if it belongs to ``user_id`` (authorization)."""
        res = (
            self._client.table("spaces")
            .select("*")
            .eq("id", space_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return res.data if res else None

    def get_space_any(self, *, space_id: str) -> dict | None:
        """Return the space with no owner filter.

        Left for callers that have already authorized access some other way.
        Sharing is per-source now, so space-level viewability is not a thing.
        """
        res = (
            self._client.table("spaces")
            .select("*")
            .eq("id", space_id)
            .maybe_single()
            .execute()
        )
        return res.data if res else None

    def slug_exists(self, *, user_id: str, slug: str) -> bool:
        res = (
            self._client.table("spaces")
            .select("id")
            .eq("user_id", user_id)
            .eq("slug", slug)
            .limit(1)
            .execute()
        )
        return bool(res.data)

    def count_spaces(self, user_id: str) -> int:
        res = (
            self._client.table("spaces")
            .select("id")
            .eq("user_id", user_id)
            .execute()
        )
        return len(res.data or [])

    def delete_space(self, *, space_id: str) -> None:
        """Drop the space row. Dependents cascade in Postgres."""
        self._client.table("spaces").delete().eq("id", space_id).execute()

    # --- active space (a column on profiles) ---

    def get_active_space_id(self, user_id: str) -> str | None:
        res = (
            self._client.table("profiles")
            .select("active_space_id")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        return (res.data or {}).get("active_space_id") if res else None

    def set_active_space(self, *, user_id: str, space_id: str | None) -> None:
        (
            self._client.table("profiles")
            .update({"active_space_id": space_id})
            .eq("id", user_id)
            .execute()
        )

    # --- sources ---

    def upsert_source(self, row: dict) -> dict:
        """Insert a source, or update it when the caller reuses the row id.

        Conflict target is the primary key. Recapture of the same page (same
        hash or same identity URL) passes the existing id so title, url, hash,
        and status refresh in place without minting a duplicate.
        """
        res = (
            self._client.table("sources")
            .upsert(row, on_conflict="id")
            .execute()
        )
        return res.data[0]

    def get_source_by_hash(self, *, space_id: str, content_hash: str) -> dict | None:
        """Existing capture of the same content in the same space, if any."""
        res = (
            self._client.table("sources")
            .select("*")
            .eq("space_id", space_id)
            .eq("content_hash", content_hash)
            .maybe_single()
            .execute()
        )
        return res.data if res else None

    def get_source_by_url(self, *, space_id: str, urls: list[str]) -> dict | None:
        """Oldest capture in this space whose url is one of ``urls``."""
        if not urls:
            return None
        res = (
            self._client.table("sources")
            .select("*")
            .eq("space_id", space_id)
            .in_("url", urls)
            .order("captured_at")
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0] if rows else None

    def list_sources(
        self, *, user_id: str, space_id: str | None = None, limit: int = 20
    ) -> list[dict]:
        """Recent sources for the user, optionally scoped to one space."""
        query = (
            self._client.table("sources")
            .select("*, spaces(name, slug)")
            .eq("user_id", user_id)
        )
        if space_id is not None:
            query = query.eq("space_id", space_id)
        res = query.order("captured_at", desc=True).limit(limit).execute()
        return res.data or []

    def list_sources_for_space(self, *, space_id: str, limit: int = 20) -> list[dict]:
        """Sources in one space, with no owner filter.

        The caller must already have authorized access to ``space_id``;
        this method itself enforces nothing.
        """
        res = (
            self._client.table("sources")
            .select("*, spaces(name, slug)")
            .eq("space_id", space_id)
            .order("captured_at", desc=True)
            .limit(limit)
            .execute()
        )
        return res.data or []

    def get_source_any(self, *, source_id: str) -> dict | None:
        """Return the source with no owner filter — see ``list_sources_for_space``."""
        res = (
            self._client.table("sources")
            .select("*")
            .eq("id", source_id)
            .maybe_single()
            .execute()
        )
        return res.data if res else None

    def get_source(self, *, user_id: str, source_id: str) -> dict | None:
        """Return the source only if it belongs to ``user_id`` (authorization)."""
        res = (
            self._client.table("sources")
            .select("*")
            .eq("id", source_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return res.data if res else None

    def delete_source(self, *, source_id: str) -> None:
        """Drop the source row. Dependents cascade in Postgres."""
        self._client.table("sources").delete().eq("id", source_id).execute()

    def update_source_summary(
        self,
        *,
        source_id: str,
        summary_text: str,
        summary_sections: dict,
        summary_model: str,
        summarized_at: str,
    ) -> None:
        self._client.table("sources").update(
            {
                "summary_text": summary_text,
                "summary_sections": summary_sections,
                "summary_model": summary_model,
                "summarized_at": summarized_at,
            }
        ).eq("id", source_id).execute()

    def update_processing_status(self, *, source_id: str, status: str) -> None:
        self._client.table("sources").update(
            {"processing_status": status}
        ).eq("id", source_id).execute()

    def list_unextracted_sources(self, *, space_id: str, limit: int) -> list[dict]:
        """Sources in a space with no concept extraction yet, oldest first.

        Oldest-first so a repeatedly-called backfill makes monotonic progress
        instead of re-picking the same recent rows.
        """
        res = (
            self._client.table("sources")
            .select("*")
            .eq("space_id", space_id)
            .is_("concepts_extracted_at", "null")
            .order("captured_at")
            .limit(limit)
            .execute()
        )
        return res.data or []

    def mark_concepts_extracted(
        self, *, source_id: str, model: str, extracted_at: str
    ) -> None:
        self._client.table("sources").update(
            {"concepts_model": model, "concepts_extracted_at": extracted_at}
        ).eq("id", source_id).execute()

    def list_source_messages(self, *, source_id: str) -> list[dict]:
        res = (
            self._client.table("source_messages")
            .select("*")
            .eq("source_id", source_id)
            .order("created_at")
            .execute()
        )
        return res.data or []

    def insert_source_message(
        self, *, source_id: str, space_id: str, user_id: str, role: str, content: str
    ) -> dict:
        row = {
            "source_id": source_id,
            "space_id": space_id,
            "user_id": user_id,
            "role": role,
            "content": content,
        }
        res = self._client.table("source_messages").insert(row).execute()
        return res.data[0]


    # --- folders ---

    def create_folder(self, *, space_id: str, user_id: str, name: str) -> dict:
        res = (
            self._client.table("space_folders")
            .insert({"space_id": space_id, "user_id": user_id, "name": name})
            .execute()
        )
        return res.data[0]

    def list_folders(self, *, space_id: str) -> list[dict]:
        """Folders in a space, with per-folder source counts, name-sorted."""
        res = (
            self._client.table("space_folders")
            .select("*")
            .eq("space_id", space_id)
            .order("name")
            .execute()
        )
        folders = res.data or []
        counts_res = (
            self._client.table("sources")
            .select("folder_id")
            .eq("space_id", space_id)
            .execute()
        )
        counts: dict[str, int] = {}
        for row in counts_res.data or []:
            fid = row.get("folder_id")
            if fid:
                counts[fid] = counts.get(fid, 0) + 1
        for folder in folders:
            folder["source_count"] = counts.get(folder["id"], 0)
        return folders

    def get_folder(self, *, space_id: str, folder_id: str) -> dict | None:
        res = (
            self._client.table("space_folders")
            .select("*")
            .eq("id", folder_id)
            .eq("space_id", space_id)
            .maybe_single()
            .execute()
        )
        return res.data if res else None

    def rename_folder(self, *, folder_id: str, name: str) -> dict:
        res = (
            self._client.table("space_folders")
            .update({"name": name})
            .eq("id", folder_id)
            .execute()
        )
        return res.data[0]

    def delete_folder(self, *, folder_id: str) -> None:
        self._client.table("space_folders").delete().eq("id", folder_id).execute()

    def set_source_folder(self, *, source_id: str, folder_id: str | None) -> dict:
        res = (
            self._client.table("sources")
            .update({"folder_id": folder_id})
            .eq("id", source_id)
            .execute()
        )
        return res.data[0]
