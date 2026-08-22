"""Daily study streaks.

Activity is deliberately narrow: capturing a source, or marking a review item
reviewed — the two actions that already write a user-scoped timestamp today.
UTC calendar days, no per-user timezone (no field to hold one exists on
``profiles`` yet), no grace/freeze mechanics — a lean definition matching this
feature's Later-priority scope, not a spaced-repetition-grade habit engine.
"""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime, timedelta

from app.repositories.profile_repo import ProfileRepo

logger = logging.getLogger(__name__)


class StreakService:
    def __init__(self, profiles: ProfileRepo) -> None:
        self._profiles = profiles

    def record_activity(self, user_id: str) -> None:
        """Count today toward the user's streak, if it hasn't been already.

        Never raises — a streak bug must not block the capture or review
        action that triggered it.
        """
        try:
            self._record_activity(user_id)
        except Exception:  # noqa: BLE001 - streak updates are strictly best-effort
            logger.warning("streak_update_failed", extra={"user_id": user_id})

    def _record_activity(self, user_id: str) -> None:
        profile = self._profiles.get_profile(user_id)
        if not profile:
            # No profile row yet (onboarding incomplete) — nothing to update.
            return

        today = datetime.now(UTC).date()
        last_active = self._parse_date(profile.get("last_active_date"))
        if last_active == today:
            return  # already counted today

        current = (
            profile.get("current_streak", 0) + 1
            if last_active == today - timedelta(days=1)
            else 1
        )
        longest = max(profile.get("longest_streak", 0), current)

        self._profiles.update_streak(
            user_id=user_id,
            current_streak=current,
            longest_streak=longest,
            last_active_date=today.isoformat(),
        )

    @staticmethod
    def _parse_date(value: str | None) -> date | None:
        return date.fromisoformat(value) if value else None
