"""Public learning profile routes (thin: delegate to ProfileService)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_authenticated_app_user, get_profile_service
from app.schemas.common import User
from app.schemas.profile import (
    ProfileVisibilityRequest,
    ProfileVisibilityResponse,
    PublicProfileResponse,
)
from app.services.profile_service import ProfileService

router = APIRouter(prefix="/profile", tags=["profile"])
# Deliberately not under /profile and deliberately with no auth dependency —
# the one unauthenticated read route in this app. Reachable only once the
# owner has opted in via PUT /profile/visibility; see ProfileService.
public_router = APIRouter(tags=["profile"])


@router.get("/visibility", response_model=ProfileVisibilityResponse)
def get_profile_visibility(
    user: User = Depends(get_authenticated_app_user),
    svc: ProfileService = Depends(get_profile_service),
) -> ProfileVisibilityResponse:
    return svc.get_visibility(user)


@router.put("/visibility", response_model=ProfileVisibilityResponse)
def set_profile_visibility(
    body: ProfileVisibilityRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: ProfileService = Depends(get_profile_service),
) -> ProfileVisibilityResponse:
    return svc.set_visibility(user, body.profile_public)


@public_router.get("/profiles/{username}", response_model=PublicProfileResponse)
def get_public_profile(
    username: str,
    svc: ProfileService = Depends(get_profile_service),
) -> PublicProfileResponse:
    """A user's opted-in public profile. No authentication required."""
    return svc.get_public_profile(username)
