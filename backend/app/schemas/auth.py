"""Authentication + profile endpoint contracts.

Request models validate inbound payloads; response models keep the generated
OpenAPI/TS contract stable. Real auth (JWT via Supabase) arrives here in
Phase 2 — the Phase 0 dev-stub session lives in ``session_service``.
"""

from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field

# --- Requests ---


class UserSignup(BaseModel):
    """Payload when a user registers with email/password."""

    email: EmailStr = Field(
        ...,
        description="A valid, lowercase email address.",
        examples=["user@atlas-app.com"],
    )
    password: str = Field(
        ...,
        min_length=6,
        max_length=100,
        description="Minimum 6 characters.",
    )


class UserLogin(BaseModel):
    """Payload when a user signs in."""

    email: EmailStr = Field(..., examples=["user@atlas-app.com"])
    password: str = Field(..., min_length=1)


class ProfileUpsertRequest(BaseModel):
    """Onboarding/profile write payload."""

    full_name: str = Field(..., min_length=1)
    username: str = Field(..., min_length=3, pattern="^[a-z0-9_]+$")
    primary_role: str
    domain_of_focus: str
    referral_source: str


# --- Responses ---


class AuthUser(BaseModel):
    id: str
    email: str


class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: AuthUser


class OnboardingStatusResponse(BaseModel):
    has_completed_onboarding: bool


class UsernameAvailabilityResponse(BaseModel):
    is_taken: bool


class MessageResponse(BaseModel):
    message: str
