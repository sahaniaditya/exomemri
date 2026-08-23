"""Learning Space routes (thin: delegate to SpaceService)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.dependencies import get_authenticated_app_user, get_space_service
from app.schemas.common import User
from app.schemas.spaces import (
    CreateFolderRequest,
    CreateSpaceRequest,
    FolderListResponse,
    FolderSummary,
    RenameFolderRequest,
    SourceListResponse,
    SpaceListResponse,
    SpaceSummary,
)
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

