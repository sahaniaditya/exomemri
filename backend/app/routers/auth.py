"""Authentication + profile routes (thin: delegate to AuthService)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request, status

from app.config import Settings, get_settings
from app.dependencies import (
    get_auth_service,
    get_authenticated_user,
    get_bearer_token,
)
from app.rate_limit import check_login_rate_limits, get_rate_limiter,check_password_reset_rate_limits
from app.schemas.auth import (
    AuthUser,
    LoginResponse,
    MessageResponse,
    OnboardingStatusResponse,
    ProfileUpsertRequest,
    UserLogin,
    UsernameAvailabilityResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    OkResponse,
)
from app.services.auth_service import AuthService
from app.services.rate_limit_service import RateLimitService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(
    body: UserLogin,
    request: Request,
    svc: AuthService = Depends(get_auth_service),
    limiter: RateLimitService = Depends(get_rate_limiter),
    settings: Settings = Depends(get_settings),
) -> LoginResponse:
    check_login_rate_limits(
        request=request, email=body.email, limiter=limiter, settings=settings
    )
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
    return svc.get_me(user)


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

@router.post("/forgot-password", response_model=OkResponse, status_code=status.HTTP_200_OK)
def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    svc: AuthService = Depends(get_auth_service),
    limiter: RateLimitService = Depends(get_rate_limiter),
    settings: Settings = Depends(get_settings),
) -> OkResponse:
    check_password_reset_rate_limits(
        request=request, email=body.email, limiter=limiter, settings=settings
    )
    svc.request_password_reset(body.email)
    return OkResponse()


@router.post("/reset-password", response_model=OkResponse, status_code=status.HTTP_200_OK)
def reset_password(
    body: ResetPasswordRequest,
    svc: AuthService = Depends(get_auth_service),
) -> OkResponse:
    svc.reset_password(body.token_hash, body.password)
    return OkResponse()
