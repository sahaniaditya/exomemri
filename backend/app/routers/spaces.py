"""Learning Space routes (thin: delegate to SpaceService / NoteService)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.dependencies import (
    get_authenticated_app_user,
    get_note_service,
    get_space_service,
)
from app.schemas.common import User
from app.schemas.notes import (
    CreateNotePageRequest,
    NoteImageUploadRequest,
    NoteImageUploadResponse,
    SpaceNotePageListResponse,
    SpaceNotePageResponse,
    UpdateNotePageRequest,
)
from app.schemas.spaces import (
    ArtifactUrlResponse,
    CreateFolderRequest,
    CreateSpaceRequest,
    FolderListResponse,
    FolderSummary,
    RenameFolderRequest,
    SourceListResponse,
    SpaceListResponse,
    SpaceSummary,
)
from app.services.note_service import NoteService
from app.services.space_service import SpaceService

router = APIRouter(prefix="/spaces", tags=["spaces"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=SpaceSummary)
def create_space(
    body: CreateSpaceRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: SpaceService = Depends(get_space_service),
) -> SpaceSummary:
    return svc.create(user, body.name, body.goal_text)


@router.get("", response_model=SpaceListResponse)
def list_spaces(
    user: User = Depends(get_authenticated_app_user),
    svc: SpaceService = Depends(get_space_service),
) -> SpaceListResponse:
    return SpaceListResponse(spaces=svc.list(user))


@router.get("/{space_id}/sources", response_model=SourceListResponse)
def list_space_sources(
    space_id: UUID,
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_authenticated_app_user),
    svc: SpaceService = Depends(get_space_service),
) -> SourceListResponse:
    return SourceListResponse(
        sources=svc.list_sources(user, space_id=space_id, limit=limit)
    )


@router.get("/{space_id}/folders", response_model=FolderListResponse)
def list_space_folders(
    space_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: SpaceService = Depends(get_space_service),
) -> FolderListResponse:
    return FolderListResponse(folders=svc.list_folders(user, space_id))


@router.post(
    "/{space_id}/folders",
    status_code=status.HTTP_201_CREATED,
    response_model=FolderSummary,
)
def create_space_folder(
    space_id: UUID,
    body: CreateFolderRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: SpaceService = Depends(get_space_service),
) -> FolderSummary:
    return svc.create_folder(user, space_id, body.name)


@router.patch("/{space_id}/folders/{folder_id}", response_model=FolderSummary)
def rename_space_folder(
    space_id: UUID,
    folder_id: UUID,
    body: RenameFolderRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: SpaceService = Depends(get_space_service),
) -> FolderSummary:
    return svc.rename_folder(user, space_id, folder_id, body.name)


@router.delete("/{space_id}/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_space_folder(
    space_id: UUID,
    folder_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: SpaceService = Depends(get_space_service),
) -> None:
    svc.delete_folder(user, space_id, folder_id)


@router.get("/{space_id}/notes", response_model=SpaceNotePageListResponse)
async def list_space_notes(
    space_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteService = Depends(get_note_service),
) -> SpaceNotePageListResponse:
    return await svc.list_space_pages(user=user, space_id=space_id)


@router.post(
    "/{space_id}/notes",
    status_code=status.HTTP_201_CREATED,
    response_model=SpaceNotePageResponse,
)
async def create_space_note(
    space_id: UUID,
    body: CreateNotePageRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteService = Depends(get_note_service),
) -> SpaceNotePageResponse:
    return await svc.create_space_page(user=user, space_id=space_id, payload=body)


@router.put("/{space_id}/notes/{note_id}", response_model=SpaceNotePageResponse)
async def update_space_note(
    space_id: UUID,
    note_id: UUID,
    body: UpdateNotePageRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteService = Depends(get_note_service),
) -> SpaceNotePageResponse:
    return await svc.update_space_page(
        user=user, space_id=space_id, note_id=note_id, payload=body
    )


@router.delete(
    "/{space_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_space_note(
    space_id: UUID,
    note_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteService = Depends(get_note_service),
) -> None:
    await svc.delete_space_page(user=user, space_id=space_id, note_id=note_id)


@router.post("/{space_id}/note-images", response_model=NoteImageUploadResponse)
async def create_space_note_image_upload(
    space_id: UUID,
    body: NoteImageUploadRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteService = Depends(get_note_service),
) -> NoteImageUploadResponse:
    return await svc.create_space_image_upload(
        user=user, space_id=space_id, payload=body
    )


@router.get("/{space_id}/note-artifact-url", response_model=ArtifactUrlResponse)
async def get_space_note_artifact_url(
    space_id: UUID,
    key: str = Query(..., min_length=1),
    user: User = Depends(get_authenticated_app_user),
    svc: NoteService = Depends(get_note_service),
) -> ArtifactUrlResponse:
    return await svc.space_note_artifact_url(user=user, space_id=space_id, key=key)

