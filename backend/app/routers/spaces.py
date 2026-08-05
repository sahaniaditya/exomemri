"""Learning Space routes (thin: delegate to SpaceService)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.dependencies import get_authenticated_app_user, get_space_service
from app.schemas.common import User
from app.schemas.spaces import (
    CreateSpaceRequest,
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
