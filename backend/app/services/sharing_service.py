"""Read-only capture sharing: grant/revoke/list collaborators.

Account-based, not a public link: the recipient must be a real Atlas user
(resolved by username), so access is per-person and revocable, and captured
content never sits behind an unauthenticated route. A collaborator's access
is read-only and scoped to that one source — see
``SpaceService.require_viewable_source``, which this feature's grants make
non-empty. Chat, the knowledge graph, other captures in the space, and
writes stay owner-only; nothing here touches those.
"""

from __future__ import annotations

from uuid import UUID

from app.errors import ConflictError, NotFoundError, ValidationError
from app.repositories.collaborator_repo import CollaboratorRepo
from app.repositories.profile_repo import ProfileRepo
from app.schemas.common import User
from app.schemas.sharing import CollaboratorResponse, SharedSourceSummary
from app.services.space_service import SpaceService


class SharingService:
    def __init__(
        self, collaborators: CollaboratorRepo, spaces: SpaceService, profiles: ProfileRepo
    ) -> None:
        self._collaborators = collaborators
        self._spaces = spaces
        self._profiles = profiles

    def invite(self, owner: User, source_id: UUID, username: str) -> CollaboratorResponse:
        source = self._spaces.require_owned_source(owner, source_id)

        profile = self._profiles.get_by_username(username.strip().lower())
        if not profile:
            raise NotFoundError(
                "No Atlas user with that username.", detail={"username": username}
            )
        if profile["id"] == str(owner.id):
            raise ValidationError("You already own this capture.")

        if self._collaborators.is_collaborator(
            source_id=str(source_id), user_id=profile["id"]
        ):
            raise ConflictError("This capture is already shared with them.")

        try:
            self._collaborators.add(
                source_id=str(source_id),
                space_id=source["space_id"],
                user_id=profile["id"],
                invited_by=str(owner.id),
            )
        except Exception as exc:  # noqa: BLE001 - map the unique index to 409
            msg = str(exc).lower()
            if "23505" in msg or "violates unique constraint" in msg:
                raise ConflictError("This capture is already shared with them.") from exc
            raise

        return CollaboratorResponse(
            user_id=UUID(profile["id"]),
            username=profile["username"],
            full_name=profile.get("full_name"),
        )

    def revoke(self, owner: User, source_id: UUID, collaborator_user_id: UUID) -> None:
        self._spaces.require_owned_source(owner, source_id)
        self._collaborators.remove(
            source_id=str(source_id), user_id=str(collaborator_user_id)
        )

    def list_collaborators(self, owner: User, source_id: UUID) -> list[CollaboratorResponse]:
        self._spaces.require_owned_source(owner, source_id)
        rows = self._collaborators.list_for_source(source_id=str(source_id))
        out: list[CollaboratorResponse] = []
        for row in rows:
            profile = self._profiles.get_profile(row["user_id"]) or {}
            out.append(
                CollaboratorResponse(
                    user_id=UUID(row["user_id"]),
                    username=profile.get("username", ""),
                    full_name=profile.get("full_name"),
                    created_at=row.get("created_at"),
                )
            )
        return out

    def list_shared_with_me(self, user: User) -> list[SharedSourceSummary]:
        rows = self._collaborators.list_for_user(user_id=str(user.id))
        summaries: list[SharedSourceSummary] = []
        for row in rows:
            source = row.get("sources")
            if not source:
                continue  # source deleted; cascade will remove this row shortly
            space = row.get("spaces") or {}
            owner = self._profiles.get_profile(source["user_id"])
            summaries.append(
                SharedSourceSummary(
                    source_id=UUID(source["id"]),
                    title=source["title"],
                    type=source["type"],
                    url=source.get("url"),
                    author=source.get("author"),
                    captured_at=source.get("captured_at"),
                    processing_status=source["processing_status"],
                    space_id=UUID(source["space_id"]),
                    space_name=space.get("name") or "",
                    owner_username=owner.get("username") if owner else None,
                    shared_at=row.get("created_at"),
                )
            )
        return summaries
