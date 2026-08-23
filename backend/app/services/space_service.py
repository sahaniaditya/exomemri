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

from app.errors import ConflictError, NotFoundError
from app.repositories.collaborator_repo import CollaboratorRepo
from app.repositories.space_repo import SpaceRepo
from app.schemas.common import User
from app.schemas.spaces import SourceCounts, SourceSummary, SpaceSummary

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
    def __init__(self, spaces: SpaceRepo, collaborators: CollaboratorRepo) -> None:
        self._spaces = spaces
        self._collaborators = collaborators

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

    def require_viewable_space(self, user: User, space_id: UUID) -> dict:
        """The space row if the caller owns it OR is a read-only collaborator.

        Still 404, not 403, on failure — same unenumerable-ids rule as
        ``require_owned_space``. This is strictly a superset of that check:
        every owner-only call site keeps using ``require_owned_space``
        unchanged, and only the curated-content reads (sources, summaries,
        the knowledge-map graph) route through this one instead.
        """
        space = self._spaces.get_space(user_id=str(user.id), space_id=str(space_id))
        if space:
            return space
        if self._collaborators.is_collaborator(space_id=str(space_id), user_id=str(user.id)):
            space = self._spaces.get_space_any(space_id=str(space_id))
            if space:
                return space
        raise NotFoundError(
            "Learning Space not found.", detail={"space_id": str(space_id)}
        )

    def require_viewable_source(self, user: User, source_id: UUID) -> dict:
        """Like ``require_viewable_space``, for a single source."""
        source = self._spaces.get_source(user_id=str(user.id), source_id=str(source_id))
        if source:
            return source
        source = self._spaces.get_source_any(source_id=str(source_id))
        if source and self._collaborators.is_collaborator(
            space_id=source["space_id"], user_id=str(user.id)
        ):
            return source
        raise NotFoundError("Source not found.", detail={"source_id": str(source_id)})

    # --- sources ---

    def list_sources(
        self, user: User, *, space_id: UUID | None = None, limit: int = 20
    ) -> list[SourceSummary]:
        if space_id is not None:
            # A superset of ownership — lets a read-only collaborator see the
            # space's captures without granting them any write access.
            self.require_viewable_space(user, space_id)
            rows = self._spaces.list_sources_for_space(space_id=str(space_id), limit=limit)
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

        Conflicts on ``(space_id, content_hash)``; callers pass the id returned
        by :meth:`existing_source_id` so a re-capture updates that row in place.
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