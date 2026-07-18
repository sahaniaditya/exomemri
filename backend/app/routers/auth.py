"""Authentication + profile routes (thin: delegate to AuthService)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.dependencies import (
    get_auth_service,
    get_authenticated_user,
    get_bearer_token,
)
from app.schemas.auth import (
    AuthUser,
    LoginResponse,
    MessageResponse,
    OnboardingStatusResponse,
    ProfileUpsertRequest,
    UserLogin,
    UsernameAvailabilityResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(
    body: UserLogin,
    svc: AuthService = Depends(get_auth_service),
) -> LoginResponse:
    return svc.login(body.email, body.password)


@router.post("/logout", response_model=MessageResponse)
def logout(
    _user: AuthUser = Depends(get_authenticated_user),
    token: str = Depends(get_bearer_token),
    svc: AuthService = Depends(get_auth_service),
) -> MessageResponse:
    svc.logout(token)
    return MessageResponse(message="Successfully logged out of backend session.")


@router.get("/me")
def get_me(
    user: AuthUser = Depends(get_authenticated_user),
    svc: AuthService = Depends(get_auth_service),
) -> dict:
    """Return the full profile row for the authenticated user."""
    return svc.get_profile(user.id)


@router.get("/profile-status", response_model=OnboardingStatusResponse)
def profile_status(
    user: AuthUser = Depends(get_authenticated_user),
    svc: AuthService = Depends(get_auth_service),
) -> OnboardingStatusResponse:
    return OnboardingStatusResponse(
        has_completed_onboarding=svc.has_completed_onboarding(user.id)
    )


@router.get("/check-username", response_model=UsernameAvailabilityResponse)
def check_username(
    username: str = Query(..., min_length=3, pattern="^[a-z0-9_]+$"),
    _user: AuthUser = Depends(get_authenticated_user),
    svc: AuthService = Depends(get_auth_service),
) -> UsernameAvailabilityResponse:
    return UsernameAvailabilityResponse(is_taken=svc.username_taken(username))


@router.post("/profile", response_model=MessageResponse)
def upsert_profile(
    payload: ProfileUpsertRequest,
    user: AuthUser = Depends(get_authenticated_user),
    svc: AuthService = Depends(get_auth_service),
) -> MessageResponse:
    svc.upsert_profile(user.id, payload)
    return MessageResponse(message="Profile configured successfully.")
