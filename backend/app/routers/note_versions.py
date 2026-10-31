"""Note version history routes (thin: delegate to NoteVersionService)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies import get_authenticated_app_user, get_note_version_service
from app.schemas.common import User
from app.schemas.note_versions import (
    CreateNoteVersionRequest,
    NoteVersionListResponse,
    NoteVersionResponse,
    NoteVersionSummary,
)
from app.schemas.notes import SpaceNotePageResponse
from app.services.note_version_service import NoteVersionService

router = APIRouter(
    prefix="/spaces/{space_id}/notes/{note_id}/versions", tags=["note-versions"]
)


@router.post("", response_model=NoteVersionSummary)
async def create_version(
    space_id: UUID,
    note_id: UUID,
    body: CreateNoteVersionRequest | None = None,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteVersionService = Depends(get_note_version_service),
) -> NoteVersionSummary:
    reason = body.reason if body else "idle"
    return await svc.create_snapshot(
        user=user, space_id=space_id, note_id=note_id, reason=reason
    )


@router.get("", response_model=NoteVersionListResponse)
async def list_versions(
    space_id: UUID,
    note_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteVersionService = Depends(get_note_version_service),
) -> NoteVersionListResponse:
    return await svc.list_versions(user=user, space_id=space_id, note_id=note_id)


@router.get("/{version_id}", response_model=NoteVersionResponse)
async def get_version(
    space_id: UUID,
    note_id: UUID,
    version_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteVersionService = Depends(get_note_version_service),
) -> NoteVersionResponse:
    return await svc.get_version(
        user=user, space_id=space_id, note_id=note_id, version_id=version_id
    )


@router.post("/{version_id}/restore", response_model=SpaceNotePageResponse)
async def restore_version(
    space_id: UUID,
    note_id: UUID,
    version_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteVersionService = Depends(get_note_version_service),
) -> SpaceNotePageResponse:
    return await svc.restore(
        user=user, space_id=space_id, note_id=note_id, version_id=version_id
    )
