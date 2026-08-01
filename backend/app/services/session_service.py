"""Session service: the caller plus their active Learning Space.

The active space is persisted as ``profiles.active_space_id``. It used to be an
in-process dict with a hardcoded dev default, which meant every backend restart
silently reset every user's active space.
"""

from __future__ import annotations

from uuid import UUID

from app.repositories.space_repo import SpaceRepo
from app.schemas.common import Space, User
from app.schemas.session import SessionResponse
from app.services.space_service import SpaceService


class SessionService:
    def __init__(self, spaces: SpaceRepo, space_service: SpaceService) -> None:
        self._spaces = spaces
        self._space_service = space_service

    def get_session(self, user: User) -> SessionResponse:
        """Current user + active space, or ``active_space: null`` when unset.

        A user with no spaces yet has no active space; the dashboard shows its
        empty state and the extension keeps Save disabled until one exists.
        """
        active_id = self._spaces.get_active_space_id(str(user.id))
        if not active_id:
            return SessionResponse(user=user, active_space=None)

        space = self._spaces.get_space(user_id=str(user.id), space_id=active_id)
        if not space:
            # The space was deleted out from under the pointer (the FK's ON
            # DELETE SET NULL normally handles this) — report no active space.
            return SessionResponse(user=user, active_space=None)

        return SessionResponse(
            user=user,
            active_space=Space(id=UUID(space["id"]), name=space["name"], slug=space["slug"]),
        )

    def set_active_space(self, user: User, space_id: UUID) -> None:
        """Point the user at one of *their* spaces; 404 for anything else."""
        self._space_service.require_owned_space(user, space_id)
        self._spaces.set_active_space(user_id=str(user.id), space_id=str(space_id))
