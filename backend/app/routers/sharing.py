"""Read-only space-sharing routes (thin: delegate to SharingService)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.dependencies import get_authenticated_app_user, get_sharing_service
from app.schemas.common import User
from app.schemas.sharing import (
    CollaboratorListResponse,
    CollaboratorResponse,
    InviteCollaboratorRequest,
    SharedSpaceListResponse,
)
from app.services.sharing_service import SharingService

router = APIRouter(prefix="/spaces", tags=["sharing"])
# Deliberately not under /spaces — this lists spaces owned by other users, so
# it can't hang off a route that assumes the caller owns {space_id}.
shared_with_me_router = APIRouter(tags=["sharing"])


@router.post(
    "/{space_id}/collaborators",
    response_model=CollaboratorResponse,
    status_code=status.HTTP_201_CREATED,
)
def invite_collaborator(
    space_id: UUID,
    body: InviteCollaboratorRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: SharingService = Depends(get_sharing_service),
) -> CollaboratorResponse:
    return svc.invite(user, space_id, body.username)


@router.get("/{space_id}/collaborators", response_model=CollaboratorListResponse)
def list_collaborators(
    space_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: SharingService = Depends(get_sharing_service),
) -> CollaboratorListResponse:
    return CollaboratorListResponse(collaborators=svc.list_collaborators(user, space_id))


@router.delete(
    "/{space_id}/collaborators/{collaborator_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def revoke_collaborator(
    space_id: UUID,
    collaborator_user_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: SharingService = Depends(get_sharing_service),
) -> None:
    svc.revoke(user, space_id, collaborator_user_id)


@shared_with_me_router.get("/shared-with-me", response_model=SharedSpaceListResponse)
def list_shared_with_me(
    user: User = Depends(get_authenticated_app_user),
    svc: SharingService = Depends(get_sharing_service),
) -> SharedSpaceListResponse:
    """Spaces another Atlas user has shared read-only access to with me."""
    return SharedSpaceListResponse(spaces=svc.list_shared_with_me(user))
