"""Public learning profiles: an opt-in, aggregate-only view of a user's spaces.

Private by default. ``get_public_profile`` is the one read path in the app
that backs an unauthenticated route — a username that doesn't exist and a
username whose owner never opted in are indistinguishable 404s, the same
enumeration-resistance discipline ``SpaceService.require_owned_space`` uses
for space ids.
"""

from __future__ import annotations

from app.errors import NotFoundError
from app.repositories.profile_repo import ProfileRepo
from app.repositories.profile_settings_repo import ProfileSettingsRepo
from app.repositories.space_repo import SpaceRepo
from app.schemas.common import User
from app.schemas.profile import (
    ProfileVisibilityResponse,
    PublicProfileResponse,
    PublicSpaceSummary,
)


class ProfileService:
    def __init__(
        self, profiles: ProfileRepo, settings: ProfileSettingsRepo, spaces: SpaceRepo
    ) -> None:
        self._profiles = profiles
        self._settings = settings
        self._spaces = spaces

    def get_visibility(self, user: User) -> ProfileVisibilityResponse:
        settings = self._settings.get(user_id=str(user.id))
        return ProfileVisibilityResponse(
            profile_public=bool(settings and settings.get("profile_public"))
        )

    def set_visibility(self, user: User, profile_public: bool) -> ProfileVisibilityResponse:
        self._settings.upsert(user_id=str(user.id), profile_public=profile_public)
        return ProfileVisibilityResponse(profile_public=profile_public)

    def get_public_profile(self, username: str) -> PublicProfileResponse:
        profile = self._profiles.get_by_username(username.strip().lower())
        settings = self._settings.get(user_id=profile["id"]) if profile else None
        if not profile or not settings or not settings.get("profile_public"):
            # Same 404 either way — a private profile must read identically
            # to one that was never created.
            raise NotFoundError("Profile not found.")

        rows = self._spaces.list_spaces(profile["id"])
        spaces = [
            PublicSpaceSummary(
                name=row["name"],
                coverage_pct=row.get("coverage_pct"),
                source_count=(row.get("source_counts") or {}).get("total", 0),
            )
            for row in rows
            # An empty space isn't "mastered" anything yet — omit it rather
            # than pad the portfolio with zeros.
            if (row.get("source_counts") or {}).get("total", 0) > 0
        ]

        return PublicProfileResponse(
            username=profile["username"],
            full_name=profile["full_name"],
            current_streak=profile.get("current_streak", 0),
            longest_streak=profile.get("longest_streak", 0),
            spaces=spaces,
        )
