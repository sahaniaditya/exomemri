"""Read-only space sharing: grant/revoke/list collaborators.

Account-based, not a public link: the recipient must be a real Atlas user
(resolved by username), so access is per-person and revocable, and captured
content never sits behind an unauthenticated route. A collaborator's access
is read-only and scoped to curated content only — see
``SpaceService.require_viewable_space``/``require_viewable_source``, which
this feature's grants make non-empty. Review queue, study plan, and streaks
stay owner-only; nothing here touches those.
"""

from __future__ import annotations

from uuid import UUID

from app.errors import ConflictError, NotFoundError, ValidationError
from app.repositories.collaborator_repo import CollaboratorRepo
from app.repositories.profile_repo import ProfileRepo
from app.schemas.common import User
from app.schemas.sharing import CollaboratorResponse, SharedSpaceSummary
from app.services.space_service import SpaceService


class SharingService:
    def __init__(
        self, collaborators: CollaboratorRepo, spaces: SpaceService, profiles: ProfileRepo
    ) -> None:
        self._collaborators = collaborators
        self._spaces = spaces
        self._profiles = profiles

    def invite(self, owner: User, space_id: UUID, username: str) -> CollaboratorResponse:
        self._spaces.require_owned_space(owner, space_id)

        profile = self._profiles.get_by_username(username.strip().lower())
        if not profile:
            raise NotFoundError(
                "No Atlas user with that username.", detail={"username": username}
            )
        if profile["id"] == str(owner.id):
            raise ValidationError("You already own this Learning Space.")

        try:
            self._collaborators.add(
                space_id=str(space_id), user_id=profile["id"], invited_by=str(owner.id)
            )
        except Exception as exc:  # noqa: BLE001 - map the unique index to 409
            msg = str(exc).lower()
            if "23505" in msg or "violates unique constraint" in msg:
                raise ConflictError("This Learning Space is already shared with them.") from exc
            raise

        return CollaboratorResponse(
            user_id=UUID(profile["id"]),
            username=profile["username"],
            full_name=profile.get("full_name"),
        )

    def revoke(self, owner: User, space_id: UUID, collaborator_user_id: UUID) -> None:
        self._spaces.require_owned_space(owner, space_id)
        self._collaborators.remove(space_id=str(space_id), user_id=str(collaborator_user_id))

    def list_collaborators(self, owner: User, space_id: UUID) -> list[CollaboratorResponse]:
        self._spaces.require_owned_space(owner, space_id)
        rows = self._collaborators.list_for_space(space_id=str(space_id))
        return [
            CollaboratorResponse(
                user_id=UUID(row["user_id"]),
                username=(row.get("profiles") or {}).get("username", ""),
                full_name=(row.get("profiles") or {}).get("full_name"),
                created_at=row.get("created_at"),
            )
            for row in rows
        ]

    def list_shared_with_me(self, user: User) -> list[SharedSpaceSummary]:
        rows = self._collaborators.list_for_user(user_id=str(user.id))
        summaries = []
        for row in rows:
            space = row.get("spaces")
            if not space:
                continue  # space deleted; cascade will remove this row shortly
            owner = self._profiles.get_profile(space["user_id"])
            summaries.append(
                SharedSpaceSummary(
                    id=UUID(space["id"]),
                    name=space["name"],
                    slug=space["slug"],
                    owner_username=owner.get("username") if owner else None,
                    shared_at=row.get("created_at"),
                )
            )
        return summaries
