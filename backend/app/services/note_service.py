"""Per-capture user notebooks (TipTap JSON) and note-image uploads."""

from __future__ import annotations

from functools import partial
from uuid import UUID, uuid4

import anyio

from app.config import Settings
from app.errors import ValidationError
from app.repositories.note_repo import NoteRepo
from app.repositories.storage_repo import StorageRepo
from app.schemas.common import User
from app.schemas.notes import (
    NoteImageUploadRequest,
    NoteImageUploadResponse,
    NoteResponse,
    UpsertNoteRequest,
)
from app.services.capture_service import is_note_image_key
from app.services.space_service import SpaceService

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

    async def get_note(self, *, user: User, source_id: UUID) -> NoteResponse:
        source = await anyio.to_thread.run_sync(
            partial(self._spaces.require_viewable_source, user, source_id)
        )
        row = await anyio.to_thread.run_sync(
            partial(
                self._notes.get_by_source,
                source_id=str(source_id),
                user_id=source["user_id"],
            )
        )
        if not row:
            return NoteResponse(
                source_id=source_id,
                content=EMPTY_DOC,
                updated_at=None,
            )
        return NoteResponse(
            source_id=UUID(source["id"]),
            content=row.get("content") or EMPTY_DOC,
            updated_at=row.get("updated_at"),
        )

    async def upsert_note(
        self, *, user: User, source_id: UUID, payload: UpsertNoteRequest
    ) -> NoteResponse:
        source = await anyio.to_thread.run_sync(
            partial(self._spaces.require_owned_source, user, source_id)
        )
        content = payload.content or EMPTY_DOC
        row = await anyio.to_thread.run_sync(
            partial(
                self._notes.upsert,
                source_id=str(source_id),
                user_id=str(user.id),
                space_id=source["space_id"],
                content=content,
            )
        )
        return NoteResponse(
            source_id=source_id,
            content=row.get("content") or content,
            updated_at=row.get("updated_at"),
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

    def _absolute_upload_url(self, signed_url: str) -> str:
        base = self._settings.supabase_url.rstrip("/")
        if signed_url.startswith("http"):
            return signed_url
        if signed_url.startswith("/storage/v1"):
            return f"{base}{signed_url}"
        return f"{base}/storage/v1{signed_url if signed_url.startswith('/') else '/' + signed_url}"
