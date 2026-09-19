"""Authentication + profile orchestration.

Wraps Supabase Auth (sign-in/sign-out) and the ``profiles`` table behind the
uniform ``AppError`` envelope. Route handlers stay thin; all Supabase SDK
access is delegated to ``ProfileRepo`` / the auth-client factory.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from supabase import Client

from app.errors import AuthError, ConflictError, NotFoundError
from app.repositories.profile_repo import ProfileRepo
from app.repositories.supabase_client import get_auth_client
from app.schemas.auth import (
    AuthUser,
    LoginResponse,
    ProfileUpsertRequest,
)
from app.services.credits_service import CreditsService

from app.config import Settings

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(
        self,
        profiles: ProfileRepo,
        service_client: Client,
        credits: CreditsService,
        settings: Settings,
    ) -> None:
        self._profiles = profiles
        self._service_client = service_client
        self._credits = credits
        self._settings = settings

    def login(self, email: str, password: str) -> LoginResponse:
        try:
            auth_client = get_auth_client()
            res = auth_client.auth.sign_in_with_password(
                {"email": email, "password": password}
            )
        except Exception as exc:  # noqa: BLE001 - normalize SDK/auth errors
            logger.info("login_failed")
            raise AuthError("Invalid credentials") from exc
        return LoginResponse(
            access_token=res.session.access_token,
            refresh_token=res.session.refresh_token,
            user=AuthUser(id=res.user.id, email=res.user.email),
        )

    def logout(self, token: str) -> None:
        try:
            self._service_client.auth.admin.sign_out(token, scope="global")
        except Exception as exc:  # noqa: BLE001
            logger.warning("logout_failed")
            raise AuthError("Failed to end backend session") from exc

    def get_profile(self, user_id: str) -> dict:
        profile = self._profiles.get_profile(user_id)
        if not profile:
            raise NotFoundError("User profile data not found.")
        return profile

    def get_me(self, user: AuthUser) -> dict:
        """Full profile row plus the auth-layer email (not stored on profiles)."""
        return {**self.get_profile(user.id), "email": user.email}

    def has_completed_onboarding(self, user_id: str) -> bool:
        return self._profiles.get_profile(user_id) is not None

    def username_taken(self, username: str) -> bool:
        return self._profiles.username_taken(username)

    def upsert_profile(self, user_id: str, payload: ProfileUpsertRequest) -> None:
        row = {
            "id": user_id,  # bound to the authenticated token, never client-supplied
            "full_name": payload.full_name.strip(),
            "username": payload.username.strip().lower(),
            "primary_role": payload.primary_role,
            "domain_of_focus": payload.domain_of_focus,
            "referral_source": payload.referral_source,
            "updated_at": datetime.now(UTC).isoformat(),
        }
        try:
            self._profiles.upsert_profile(row)
        except Exception as exc:  # noqa: BLE001
            msg = str(exc).lower()
            if "23505" in msg or "violates unique constraint" in msg:
                raise ConflictError(
                    "This username is already taken. Please choose another."
                ) from exc
            logger.error("profile_upsert_failed")
            raise
        try:
            self._credits.ensure_for_user(user_id)
        except Exception:  # noqa: BLE001 - credits must not block onboarding
            logger.warning("credits_ensure_on_onboarding_failed", extra={"user_id": user_id})

    def request_password_reset(self, email: str) -> None:
        """Always succeeds from the caller's perspective — never reveals
        whether an account exists for this email (avoids enumeration)."""
        try:
            auth_client = get_auth_client()
            auth_client.auth.reset_password_for_email(
                email,
                {"redirect_to": f"{self._settings.frontend_url}/reset-password"},
            )
        except Exception:  # noqa: BLE001 - swallow; log only, don't leak to caller
            logger.warning("password_reset_request_failed", exc_info=True)

    def reset_password(self, token_hash: str, new_password: str) -> None:
        try:
            auth_client = get_auth_client()
            res = auth_client.auth.verify_otp(
                {"token_hash": token_hash, "type": "recovery"}
            )
        except Exception as exc:  # noqa: BLE001
            logger.info("password_reset_token_invalid", exc_info=True)
            raise AuthError("This reset link is invalid or has expired.") from exc

        user = getattr(res, "user", None)
        if not user:
            raise AuthError("This reset link is invalid or has expired.")

        try:
            self._service_client.auth.admin.update_user_by_id(
                user.id, {"password": new_password}
            )
        except Exception as exc:  # noqa: BLE001
            logger.error("password_update_failed")
            raise AuthError("Failed to update password. Please try again.") from exc
