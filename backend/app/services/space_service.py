"""Learning Space orchestration.

Owns slug derivation, the uniqueness/conflict mapping, and — most importantly —
``require_owned_space``, the single ownership check every space-scoped operation
routes through. Before this existed, ``space_id`` arrived from the client and was
never authorized, so a caller could write artifacts into any space id.
"""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime
from uuid import UUID

import anyio

from app.errors import ConflictError, NotFoundError, StorageError
from app.repositories.collaborator_repo import CollaboratorRepo
from app.repositories.space_repo import SpaceRepo
from app.repositories.storage_repo import StorageRepo
from app.schemas.common import User
from app.schemas.spaces import FolderSummary, SourceCounts, SourceSummary, SpaceSummary

logger = logging.getLogger(__name__)

MAX_SLUG_LENGTH = 60
# How many "-2", "-3", ... suffixes to try before giving up on a unique slug.
MAX_SLUG_ATTEMPTS = 50


def slugify(name: str) -> str:
    """``"Claude Code"`` -> ``"claude-code"``.

    Must satisfy the ``clean_space_slug`` CHECK constraint (``^[a-z0-9-]+$``).
    Non-alphanumerics collapse to a single hyphen; a name with nothing usable
    (e.g. all CJK or emoji) falls back to ``"space"`` so the caller still gets a
    valid slug and uniqueness is handled by the numeric suffix.
    """
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    slug = slug[:MAX_SLUG_LENGTH].strip("-")
    return slug or "space"


def _is_unique_violation(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "23505" in msg or "violates unique constraint" in msg


class SpaceService:
    def __init__(
        self,
        spaces: SpaceRepo,
        collaborators: CollaboratorRepo,
        storage: StorageRepo,
    ) -> None:
        self._spaces = spaces
        self._collaborators = collaborators
        self._storage = storage

    # --- spaces ---

    def create(self, user: User, name: str, goal_text: str | None = None) -> SpaceSummary:
        """Create a space for the caller. The first one becomes active."""
        user_id = str(user.id)
        clean_name = name.strip()
        slug = self._unique_slug(user_id, slugify(clean_name))
        is_first = self._spaces.count_spaces(user_id) == 0

        try:
            row = self._spaces.create_space(
                user_id=user_id,
                name=clean_name,
                slug=slug,
                goal_text=goal_text.strip() if goal_text else None,
            )
        except Exception as exc:  # noqa: BLE001 - map the unique index to 409
            if _is_unique_violation(exc):
                raise ConflictError(
                    "You already have a Learning Space with that name.",
                    detail={"name": clean_name},
                ) from exc
            logger.error("space_create_failed")
            raise

        if is_first:
            # Nothing can be captured without an active space, so don't make the
            # user pick one they just created as their only option.
            self._spaces.set_active_space(user_id=user_id, space_id=row["id"])

        return SpaceSummary(
            id=UUID(row["id"]),
            name=row["name"],
            slug=row["slug"],
            goal_text=row.get("goal_text"),
            created_at=row.get("created_at"),
            last_captured_at=None,
            source_counts=SourceCounts(),
        )

    def _unique_slug(self, user_id: str, base: str) -> str:
        """First free slug in ``base``, ``base-2``, ``base-3``, ...

        Advisory only — the ``spaces_user_slug_idx`` unique index is the real
        guard, and a lost race still surfaces as a ConflictError from create().
        """
        if not self._spaces.slug_exists(user_id=user_id, slug=base):
            return base
        for suffix in range(2, MAX_SLUG_ATTEMPTS + 1):
            candidate = f"{base[: MAX_SLUG_LENGTH - len(str(suffix)) - 1].strip('-')}-{suffix}"
            if not self._spaces.slug_exists(user_id=user_id, slug=candidate):
                return candidate
        raise ConflictError("Too many Learning Spaces with a similar name.")

    def list(self, user: User) -> list[SpaceSummary]:
        rows = self._spaces.list_spaces(str(user.id))
        return [
            SpaceSummary(
                id=UUID(row["id"]),
                name=row["name"],
                slug=row["slug"],
                goal_text=row.get("goal_text"),
                created_at=row.get("created_at"),
                last_captured_at=row.get("last_captured_at"),
                source_counts=SourceCounts(**(row.get("source_counts") or {})),
                coverage_pct=row.get("coverage_pct"),
            )
            for row in rows
        ]

    def require_owned_space(self, user: User, space_id: UUID) -> dict:
        """The authorization primitive: the space row, or 404.

        A space that exists but belongs to someone else is reported as
        not-found rather than forbidden, so space ids stay unenumerable.
        """
        space = self._spaces.get_space(user_id=str(user.id), space_id=str(space_id))
        if not space:
            raise NotFoundError(
                "Learning Space not found.", detail={"space_id": str(space_id)}
            )
        return space

    async def delete(self, user: User, space_id: UUID) -> None:
        """Permanently remove a Learning Space the caller owns.

        The row goes first so the dashboard cannot keep showing a space whose
        files are already gone. Storage is then cleaned up; leftover objects
        are logged rather than failing the request, so a storage blip cannot
        undelete the space.
        """

        def _drop() -> str:
            self.require_owned_space(user, space_id)
            user_id = str(user.id)
            was_active = self._spaces.get_active_space_id(user_id) == str(space_id)
            self._spaces.delete_space(space_id=str(space_id))
            if was_active:
                remaining = self._spaces.list_spaces(user_id)
                next_id = remaining[0]["id"] if remaining else None
                self._spaces.set_active_space(user_id=user_id, space_id=next_id)
            return user_id

        user_id = await anyio.to_thread.run_sync(_drop)
        logger.info("space_deleted", extra={"space_id": str(space_id)})
        prefix = f"users/{user_id}/spaces/{space_id}"
        try:
            await self._storage.delete_prefix(prefix)
        except StorageError:
            logger.error(
                "space_storage_delete_failed",
                extra={"space_id": str(space_id), "prefix": prefix},
            )

    def require_viewable_source(self, user: User, source_id: UUID) -> dict:
        """The source row if the caller owns it OR has a per-source grant.

        Still 404, not 403, on failure — source ids stay unenumerable.
        Space membership never implies source access: the collaborator check
        is on ``source_id``, not ``space_id``.
        """
        source = self._spaces.get_source(user_id=str(user.id), source_id=str(source_id))
        if source:
            return source
        source = self._spaces.get_source_any(source_id=str(source_id))
        if source and self._collaborators.is_collaborator(
            source_id=str(source_id), user_id=str(user.id)
        ):
            return source
        raise NotFoundError("Source not found.", detail={"source_id": str(source_id)})

    def get_source_any(self, source_id: UUID) -> dict | None:
        """Source row with no owner filter — for share-link redeem after token auth."""
        return self._spaces.get_source_any(source_id=str(source_id))

    def get_space_any(self, space_id: UUID) -> dict | None:
        """Space row with no owner filter — labels for share-link redeem."""
        return self._spaces.get_space_any(space_id=str(space_id))

    # --- sources ---

    def list_sources(
        self, user: User, *, space_id: UUID | None = None, limit: int = 20
    ) -> list[SourceSummary]:
        if space_id is not None:
            self.require_owned_space(user, space_id)
            rows = self._spaces.list_sources(
                user_id=str(user.id), space_id=str(space_id), limit=limit
            )
        else:
            rows = self._spaces.list_sources(user_id=str(user.id), limit=limit)
        return [self._to_source_summary(row) for row in rows]

    def existing_source_id(self, *, space_id: UUID, content_hash: str) -> UUID | None:
        """Id of a prior capture of the same content in this space, if any.

        Reusing it keeps the row id and the storage prefix (which embeds the
        source id) in agreement when a page is captured twice.
        """
        row = self._spaces.get_source_by_hash(
            space_id=str(space_id), content_hash=content_hash
        )
        return UUID(row["id"]) if row else None

    def existing_source_id_for_url(
        self, *, space_id: UUID, urls: list[str]
    ) -> UUID | None:
        """Id of the oldest capture in this space matching one of ``urls``."""
        row = self._spaces.get_source_by_url(space_id=str(space_id), urls=urls)
        return UUID(row["id"]) if row else None

    def record_source(
        self,
        *,
        user: User,
        source_id: UUID,
        space_id: UUID,
        source_type: str,
        title: str,
        url: str | None,
        author: str | None,
        storage_prefix: str,
        content_hash: str,
        processing_status: str,
        captured_at: str,
    ) -> dict:
        """Record a capture. Called only after its artifacts are in storage.

        Conflicts on ``id``; callers pass the id returned by
        :meth:`existing_source_id` / :meth:`existing_source_id_for_url` so a
        re-capture updates that row in place.
        """
        return self._spaces.upsert_source(
            {
                "id": str(source_id),
                "space_id": str(space_id),
                "user_id": str(user.id),
                "type": source_type,
                "title": title,
                "url": url,
                "author": author,
                "storage_prefix": storage_prefix,
                "content_hash": content_hash,
                "processing_status": processing_status,
                "captured_at": captured_at,
            }
        )

    def require_owned_source(self, user: User, source_id: UUID) -> dict:
        source = self._spaces.get_source(user_id=str(user.id), source_id=str(source_id))
        if not source:
            raise NotFoundError(
                "Source not found.", detail={"source_id": str(source_id)}
            )
        return source

    def delete_source(self, user: User, source_id: UUID) -> dict:
        """Owner-only: drop the source row. Storage cleanup is the caller's job."""
        source = self.require_owned_source(user, source_id)
        self._spaces.delete_source(source_id=str(source_id))
        logger.info(
            "source_deleted",
            extra={"source_id": str(source_id), "space_id": source["space_id"]},
        )
        return source

    @staticmethod
    def _to_source_summary(row: dict) -> SourceSummary:
        # `select("*, spaces(name, slug)")` nests the joined space; it is absent
        # when the row came from a plain select.
        space = row.get("spaces") or {}
        return SourceSummary(
            id=UUID(row["id"]),
            space_id=UUID(row["space_id"]),
            space_name=space.get("name"),
            type=row["type"],
            title=row["title"],
            url=row.get("url"),
            author=row.get("author"),
            captured_at=row.get("captured_at"),
            processing_status=row["processing_status"],
            folder_id=UUID(row["folder_id"]) if row.get("folder_id") else None,
        )

    def update_processing_status(self, *, source_id: UUID, status: str) -> None:
        self._spaces.update_processing_status(source_id=str(source_id), status=status)

    def save_summary(
        self, *, source_id: UUID, summary: str, sections: dict, model: str
    ) -> None:
        self._spaces.update_source_summary(
            source_id=str(source_id),
            summary_text=summary,
            summary_sections=sections,
            summary_model=model,
            summarized_at=datetime.now(UTC).isoformat(),
        )

    def list_unextracted_sources(self, *, space_id: UUID, limit: int) -> list[dict]:
        """Sources in a space whose concepts have never been extracted."""
        return self._spaces.list_unextracted_sources(space_id=str(space_id), limit=limit)

    def mark_concepts_extracted(self, *, source_id: UUID, model: str) -> None:
        self._spaces.mark_concepts_extracted(
            source_id=str(source_id),
            model=model,
            extracted_at=datetime.now(UTC).isoformat(),
        )

    def list_messages(self, source_id: UUID) -> list[dict]:
        return self._spaces.list_source_messages(source_id=str(source_id))

    def add_message(
        self, *, user: User, source_id: UUID, space_id: UUID, role: str, content: str
    ) -> dict:
        return self._spaces.insert_source_message(
            source_id=str(source_id),
            space_id=str(space_id),
            user_id=str(user.id),
            role=role,
            content=content,
        )

    def _require_folder(self, user: User, space_id: UUID, folder_id: UUID) -> dict:
        self.require_owned_space(user, space_id)
        folder = self._spaces.get_folder(space_id=str(space_id), folder_id=str(folder_id))
        if not folder:
            raise NotFoundError("Folder not found.", detail={"folder_id": str(folder_id)})
        return folder

    def _to_folder_summary(self, row: dict) -> FolderSummary:
        return FolderSummary(
            id=UUID(row["id"]),
            space_id=UUID(row["space_id"]),
            name=row["name"],
            created_at=row.get("created_at"),
            source_count=int(row.get("source_count") or 0),
        )

    def list_folders(self, user: User, space_id: UUID) -> list[FolderSummary]:
        self.require_owned_space(user, space_id)
        rows = self._spaces.list_folders(space_id=str(space_id))
        return [self._to_folder_summary(row) for row in rows]

    def create_folder(self, user: User, space_id: UUID, name: str) -> FolderSummary:
        self.require_owned_space(user, space_id)
        clean = name.strip()
        try:
            row = self._spaces.create_folder(
                space_id=str(space_id), user_id=str(user.id), name=clean
            )
        except Exception as exc:  # noqa: BLE001 - map the unique index to 409
            if _is_unique_violation(exc):
                raise ConflictError(
                    "You already have a folder with that name in this space.",
                    detail={"name": clean},
                ) from exc
            logger.error("folder_create_failed")
            raise
        logger.info("folder_created", extra={"space_id": str(space_id), "folder_id": row["id"]})
        row.setdefault("source_count", 0)
        return self._to_folder_summary(row)

    def rename_folder(
        self, user: User, space_id: UUID, folder_id: UUID, name: str
    ) -> FolderSummary:
        folder = self._require_folder(user, space_id, folder_id)
        clean = name.strip()
        try:
            row = self._spaces.rename_folder(folder_id=str(folder_id), name=clean)
        except Exception as exc:  # noqa: BLE001 - map the unique index to 409
            if _is_unique_violation(exc):
                raise ConflictError(
                    "You already have a folder with that name in this space.",
                    detail={"name": clean},
                ) from exc
            logger.error("folder_rename_failed")
            raise
        row["source_count"] = folder.get("source_count", 0)
        return self._to_folder_summary(row)

    def delete_folder(self, user: User, space_id: UUID, folder_id: UUID) -> None:
        self._require_folder(user, space_id, folder_id)
        self._spaces.delete_folder(folder_id=str(folder_id))
        logger.info(
            "folder_deleted",
            extra={"space_id": str(space_id), "folder_id": str(folder_id)},
        )

    def set_source_folder(
        self, user: User, source_id: UUID, folder_id: UUID | None
    ) -> SourceSummary:
        source = self.require_owned_source(user, source_id)
        if folder_id is not None:
            folder = self._spaces.get_folder(
                space_id=source["space_id"], folder_id=str(folder_id)
            )
            if not folder:
                raise NotFoundError(
                    "Folder not found.", detail={"folder_id": str(folder_id)}
                )
        row = self._spaces.set_source_folder(
            source_id=str(source_id),
            folder_id=str(folder_id) if folder_id else None,
        )
        merged = {**source, **row}
        return self._to_source_summary(merged)
