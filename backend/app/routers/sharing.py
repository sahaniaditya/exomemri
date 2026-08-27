"""Read-only capture-sharing routes (thin: delegate to SharingService)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.dependencies import get_authenticated_app_user, get_sharing_service
from app.schemas.common import User
from app.schemas.sharing import (
    CollaboratorListResponse,
    CollaboratorResponse,
    InviteCollaboratorRequest,
    RedeemShareLinkResponse,
    SharedSourceListResponse,
    ShareLinkResponse,
    ShareLinkStatusResponse,
)
from app.services.sharing_service import SharingService

router = APIRouter(prefix="/sources", tags=["sharing"])
# Deliberately not under /sources/{id} — this lists captures owned by other
# users, so it can't hang off a route that assumes the caller owns {source_id}.
shared_with_me_router = APIRouter(tags=["sharing"])
share_links_router = APIRouter(prefix="/share-links", tags=["sharing"])


@router.post(
    "/{source_id}/collaborators",
    response_model=CollaboratorResponse,
    status_code=status.HTTP_201_CREATED,
)
def invite_collaborator(
    source_id: UUID,
    body: InviteCollaboratorRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: SharingService = Depends(get_sharing_service),
) -> CollaboratorResponse:
    return svc.invite(user, source_id, body.username)


@router.get("/{source_id}/collaborators", response_model=CollaboratorListResponse)
def list_collaborators(
    source_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: SharingService = Depends(get_sharing_service),
) -> CollaboratorListResponse:
    return CollaboratorListResponse(collaborators=svc.list_collaborators(user, source_id))


@router.delete(
    "/{source_id}/collaborators/{collaborator_user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def revoke_collaborator(
    source_id: UUID,
    collaborator_user_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: SharingService = Depends(get_sharing_service),
) -> None:
    svc.revoke(user, source_id, collaborator_user_id)


@router.get("/{source_id}/share-link", response_model=ShareLinkStatusResponse)
def get_share_link(
    source_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: SharingService = Depends(get_sharing_service),
) -> ShareLinkStatusResponse:
    return svc.get_link(user, source_id)


@router.put("/{source_id}/share-link", response_model=ShareLinkResponse)
def create_or_get_share_link(
    source_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: SharingService = Depends(get_sharing_service),
) -> ShareLinkResponse:
    return svc.create_or_get_link(user, source_id)


@router.delete(
    "/{source_id}/share-link",
    status_code=status.HTTP_204_NO_CONTENT,
)
def revoke_share_link(
    source_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: SharingService = Depends(get_sharing_service),
) -> None:
    svc.revoke_link(user, source_id)


@shared_with_me_router.get("/shared-with-me", response_model=SharedSourceListResponse)
def list_shared_with_me(
    user: User = Depends(get_authenticated_app_user),
    svc: SharingService = Depends(get_sharing_service),
) -> SharedSourceListResponse:
    """Captures another exomemri user has shared read-only access to with me."""
    return SharedSourceListResponse(sources=svc.list_shared_with_me(user))


@share_links_router.post("/{token}/redeem", response_model=RedeemShareLinkResponse)
def redeem_share_link(
    token: str,
    user: User = Depends(get_authenticated_app_user),
    svc: SharingService = Depends(get_sharing_service),
) -> RedeemShareLinkResponse:
    """Claim read-only access via a shareable link (any logged-in user)."""
    return svc.redeem_link(user, token)
