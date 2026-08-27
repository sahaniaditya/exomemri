"""Per-capture named note pages (TipTap JSON) and note-image uploads."""

from __future__ import annotations

import logging
from functools import partial
from uuid import UUID, uuid4

import anyio

from app.config import Settings
from app.errors import ConflictError, NotFoundError, ValidationError
from app.repositories.note_repo import NoteRepo
from app.repositories.storage_repo import StorageRepo
from app.schemas.common import User
from app.schemas.notes import (
    MAX_PAGES_PER_SOURCE,
    CreateNotePageRequest,
    NoteImageUploadRequest,
    NoteImageUploadResponse,
    NotePageListResponse,
    NotePageResponse,
    UpdateNotePageRequest,
)
from app.services.capture_service import is_note_image_key
from app.services.space_service import SpaceService

logger = logging.getLogger(__name__)

ALLOWED_NOTE_IMAGE_TYPES: dict[str, str] = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}

EMPTY_DOC: dict = {"type": "doc", "content": [{"type": "paragraph"}]}


class NoteService:
    def __init__(
        self,
        notes: NoteRepo,
        spaces: SpaceService,
        storage: StorageRepo,
        settings: Settings,
    ) -> None:
        self._notes = notes
        self._spaces = spaces
        self._storage = storage
        self._settings = settings

    async def list_pages(self, *, user: User, source_id: UUID) -> NotePageListResponse:
        source = await anyio.to_thread.run_sync(
            partial(self._spaces.require_viewable_source, user, source_id)
        )
        rows = await anyio.to_thread.run_sync(
            partial(
                self._notes.list_by_source,
                source_id=str(source_id),
                user_id=source["user_id"],
            )
        )
        return NotePageListResponse(items=[self._to_page(row) for row in rows])

    async def create_page(
        self, *, user: User, source_id: UUID, payload: CreateNotePageRequest
    ) -> NotePageResponse:
        source = await anyio.to_thread.run_sync(
            partial(self._spaces.require_owned_source, user, source_id)
        )
        existing = await anyio.to_thread.run_sync(
            partial(
                self._notes.list_by_source,
                source_id=str(source_id),
                user_id=str(user.id),
            )
        )
        if len(existing) >= MAX_PAGES_PER_SOURCE:
            raise ConflictError(
                "This capture already has the maximum number of note pages.",
                detail={"max": MAX_PAGES_PER_SOURCE},
            )
        sort_order = (int(existing[-1]["sort_order"]) + 1) if existing else 0
        note_id = str(uuid4())
        row = await anyio.to_thread.run_sync(
            partial(
                self._notes.insert,
                note_id=note_id,
                source_id=str(source_id),
                user_id=str(user.id),
                space_id=source["space_id"],
                title=payload.title,
                content=EMPTY_DOC,
                sort_order=sort_order,
            )
        )
        logger.info(
            "note_page_created",
            extra={"source_id": str(source_id), "note_id": note_id},
        )
        return self._to_page(row)

    async def update_page(
        self,
        *,
        user: User,
        source_id: UUID,
        note_id: UUID,
        payload: UpdateNotePageRequest,
    ) -> NotePageResponse:
        await anyio.to_thread.run_sync(
            partial(self._spaces.require_owned_source, user, source_id)
        )
        row = await anyio.to_thread.run_sync(
            partial(
                self._notes.update,
                source_id=str(source_id),
                note_id=str(note_id),
                user_id=str(user.id),
                title=payload.title,
                content=payload.content,
            )
        )
        if not row:
            raise NotFoundError("Note page not found.", detail={"note_id": str(note_id)})
        return self._to_page(row)

    async def delete_page(self, *, user: User, source_id: UUID, note_id: UUID) -> None:
        await anyio.to_thread.run_sync(
            partial(self._spaces.require_owned_source, user, source_id)
        )
        deleted = await anyio.to_thread.run_sync(
            partial(
                self._notes.delete,
                source_id=str(source_id),
                note_id=str(note_id),
                user_id=str(user.id),
            )
        )
        if not deleted:
            raise NotFoundError("Note page not found.", detail={"note_id": str(note_id)})
        logger.info(
            "note_page_deleted",
            extra={"source_id": str(source_id), "note_id": str(note_id)},
        )

    async def create_image_upload(
        self, *, user: User, source_id: UUID, payload: NoteImageUploadRequest
    ) -> NoteImageUploadResponse:
        source = await anyio.to_thread.run_sync(
            partial(self._spaces.require_owned_source, user, source_id)
        )
        ext = ALLOWED_NOTE_IMAGE_TYPES.get(payload.content_type.lower())
        if not ext:
            raise ValidationError(
                "Unsupported image type.",
                detail={
                    "content_type": payload.content_type,
                    "allowed": sorted(ALLOWED_NOTE_IMAGE_TYPES),
                },
            )

        key = f"notes/images/{uuid4()}.{ext}"
        if not is_note_image_key(key):
            raise ValidationError("Failed to mint a valid note image key.")

        object_path = f"{source['storage_prefix']}/{key}"
        signed = await self._storage.create_signed_upload_url(object_path)
        return NoteImageUploadResponse(
            key=key,
            upload_url=self._absolute_upload_url(signed["signed_url"]),
            token=signed["token"],
            path=object_path,
        )

    def _to_page(self, row: dict) -> NotePageResponse:
        return NotePageResponse(
            id=UUID(str(row["id"])),
            source_id=UUID(str(row["source_id"])),
            title=row["title"],
            content=row.get("content") or EMPTY_DOC,
            sort_order=int(row["sort_order"]),
            updated_at=row.get("updated_at"),
        )

    def _absolute_upload_url(self, signed_url: str) -> str:
        base = self._settings.supabase_url.rstrip("/")
        if signed_url.startswith("http"):
            return signed_url
        if signed_url.startswith("/storage/v1"):
            return f"{base}{signed_url}"
        return f"{base}/storage/v1{signed_url if signed_url.startswith('/') else '/' + signed_url}"
