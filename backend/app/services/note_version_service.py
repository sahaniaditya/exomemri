"""Version history for space notes: snapshot, list, read, restore."""

from __future__ import annotations

import logging
from functools import partial
from uuid import UUID

import anyio

from app.errors import NotFoundError
from app.repositories.note_version_repo import NoteVersionRepo
from app.repositories.space_note_repo import SpaceNoteRepo
from app.schemas.common import User
from app.schemas.note_versions import (
    MAX_VERSIONS_PER_NOTE,
    NoteVersionListResponse,
    NoteVersionResponse,
    NoteVersionSummary,
    VersionReason,
)
from app.schemas.notes import SpaceNotePageResponse
from app.services.note_service import EMPTY_DOC
from app.services.space_service import SpaceService

logger = logging.getLogger(__name__)


class NoteVersionService:
    def __init__(
        self,
        versions: NoteVersionRepo,
        space_notes: SpaceNoteRepo,
        spaces: SpaceService,
    ) -> None:
        self._versions = versions
        self._space_notes = space_notes
        self._spaces = spaces

    async def create_snapshot(
        self, *, user: User, space_id: UUID, note_id: UUID, reason: VersionReason
    ) -> NoteVersionSummary:
        """Snapshot the stored note; a no-op returning the latest if unchanged."""
        note = await self._require_note(user=user, space_id=space_id, note_id=note_id)
        latest = await anyio.to_thread.run_sync(
            partial(self._versions.latest, note_id=str(note_id), user_id=str(user.id))
        )
        unchanged = (
            latest is not None
            and latest["title"] == note["title"]
            and latest["content"] == (note.get("content") or EMPTY_DOC)
        )
        if unchanged:
            return self._to_summary(latest)
        return await self._store(user=user, note_id=note_id, note=note, reason=reason)

    async def list_versions(
        self, *, user: User, space_id: UUID, note_id: UUID
    ) -> NoteVersionListResponse:
        await self._require_note(user=user, space_id=space_id, note_id=note_id)
        rows = await anyio.to_thread.run_sync(
            partial(
                self._versions.list_summaries, note_id=str(note_id), user_id=str(user.id)
            )
        )
        return NoteVersionListResponse(items=[self._to_summary(r) for r in rows])

    async def get_version(
        self, *, user: User, space_id: UUID, note_id: UUID, version_id: UUID
    ) -> NoteVersionResponse:
        await self._require_note(user=user, space_id=space_id, note_id=note_id)
        row = await self._require_version(user=user, note_id=note_id, version_id=version_id)
        return self._to_full(row)

    async def restore(
        self, *, user: User, space_id: UUID, note_id: UUID, version_id: UUID
    ) -> SpaceNotePageResponse:
        note = await self._require_note(user=user, space_id=space_id, note_id=note_id)
        version = await self._require_version(
            user=user, note_id=note_id, version_id=version_id
        )
        # Always keep what is being overwritten, so a restore is itself undoable.
        await self._store(user=user, note_id=note_id, note=note, reason="pre_restore")
        row = await anyio.to_thread.run_sync(
            partial(
                self._space_notes.update,
                space_id=str(space_id),
                note_id=str(note_id),
                user_id=str(user.id),
                title=version["title"],
                content=version["content"],
            )
        )
        if not row:
            raise NotFoundError("Note page not found.", detail={"note_id": str(note_id)})
        logger.info(
            "note_version_restored",
            extra={"note_id": str(note_id), "version_id": str(version_id)},
        )
        return SpaceNotePageResponse(
            id=UUID(str(row["id"])),
            space_id=UUID(str(row["space_id"])),
            title=row["title"],
            content=row.get("content") or EMPTY_DOC,
            sort_order=int(row["sort_order"]),
            updated_at=row.get("updated_at"),
        )

    async def _store(
        self, *, user: User, note_id: UUID, note: dict, reason: VersionReason
    ) -> NoteVersionSummary:
        row = await anyio.to_thread.run_sync(
            partial(
                self._versions.insert,
                note_id=str(note_id),
                user_id=str(user.id),
                title=note["title"],
                content=note.get("content") or EMPTY_DOC,
                reason=reason,
            )
        )
        await anyio.to_thread.run_sync(
            partial(
                self._versions.prune,
                note_id=str(note_id),
                user_id=str(user.id),
                keep=MAX_VERSIONS_PER_NOTE,
            )
        )
        logger.info(
            "note_version_created", extra={"note_id": str(note_id), "reason": reason}
        )
        return self._to_summary(row)

    async def _require_note(self, *, user: User, space_id: UUID, note_id: UUID) -> dict:
        await anyio.to_thread.run_sync(
            partial(self._spaces.require_owned_space, user, space_id)
        )
        note = await anyio.to_thread.run_sync(
            partial(
                self._space_notes.get,
                space_id=str(space_id),
                note_id=str(note_id),
                user_id=str(user.id),
            )
        )
        if not note:
            raise NotFoundError("Note page not found.", detail={"note_id": str(note_id)})
        return note

    async def _require_version(
        self, *, user: User, note_id: UUID, version_id: UUID
    ) -> dict:
        row = await anyio.to_thread.run_sync(
            partial(
                self._versions.get,
                note_id=str(note_id),
                version_id=str(version_id),
                user_id=str(user.id),
            )
        )
        if not row:
            raise NotFoundError(
                "Note version not found.", detail={"version_id": str(version_id)}
            )
        return row

    @staticmethod
    def _to_summary(row: dict) -> NoteVersionSummary:
        return NoteVersionSummary(
            id=UUID(str(row["id"])),
            title=row["title"],
            reason=row["reason"],
            created_at=str(row["created_at"]),
        )

    @classmethod
    def _to_full(cls, row: dict) -> NoteVersionResponse:
        summary = cls._to_summary(row)
        return NoteVersionResponse(**summary.model_dump(), content=row.get("content") or {})
