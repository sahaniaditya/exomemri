"""Dev-stub session service (Phase 0).

Active space is held in-process, keyed by user id. This is intentionally
non-persistent and single-process; Phase 1 replaces it with the
``learning_sessions`` table and Phase 2 with real auth.
"""

from __future__ import annotations

from uuid import UUID

from app.config import Settings
from app.schemas.common import Space, User
from app.schemas.session import SessionResponse


class SessionService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        # user_id -> active space_id
        self._active_space: dict[UUID, UUID] = {}

    def _dev_space(self, space_id: UUID) -> Space:
        return Space(id=space_id, name=self._settings.dev_space_name)

    def get_session(self, user: User) -> SessionResponse:
        active_id = self._active_space.get(user.id, self._settings.dev_space_id)
        return SessionResponse(user=user, active_space=self._dev_space(active_id))

    def set_active_space(self, user: User, space_id: UUID) -> None:
        self._active_space[user.id] = space_id
