"""Read-only capture sharing: collaborators + shareable links.

Account-based access only: either a username invite or a redeemable link
that any logged-in user can open. Both paths land on a ``source_collaborators``
grant, so ``SpaceService.require_viewable_source`` stays the single auth gate.
Chat, the knowledge graph, other captures in the space, and writes stay
owner-only.
"""

from __future__ import annotations

import secrets
from uuid import UUID

from app.errors import ConflictError, NotFoundError, ValidationError
from app.repositories.collaborator_repo import CollaboratorRepo
from app.repositories.profile_repo import ProfileRepo
from app.repositories.share_link_repo import ShareLinkRepo
from app.schemas.common import User
from app.schemas.sharing import (
    CollaboratorResponse,
    RedeemShareLinkResponse,
    SharedSourceSummary,
    ShareLinkResponse,
    ShareLinkStatusResponse,
)
from app.services.space_service import SpaceService

_SHARE_PATH_PREFIX = "/s/"


def _share_path(token: str) -> str:
    return f"{_SHARE_PATH_PREFIX}{token}"


class SharingService:
    def __init__(
        self,
        collaborators: CollaboratorRepo,
        spaces: SpaceService,
        profiles: ProfileRepo,
        share_links: ShareLinkRepo,
    ) -> None:
        self._collaborators = collaborators
        self._spaces = spaces
        self._profiles = profiles
        self._share_links = share_links

    def invite(self, owner: User, source_id: UUID, username: str) -> CollaboratorResponse:
        source = self._spaces.require_owned_source(owner, source_id)

        profile = self._profiles.get_by_username(username.strip().lower())
        if not profile:
            raise NotFoundError(
                "No exomemri user with that username.", detail={"username": username}
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

    # --- shareable links ---

    def get_link(self, owner: User, source_id: UUID) -> ShareLinkStatusResponse:
        self._spaces.require_owned_source(owner, source_id)
        row = self._share_links.get_active_for_source(source_id=str(source_id))
        if not row:
            return ShareLinkStatusResponse(enabled=False)
        return ShareLinkStatusResponse(
            enabled=True,
            token=row["token"],
            path=_share_path(row["token"]),
            created_at=row.get("created_at"),
        )

    def create_or_get_link(self, owner: User, source_id: UUID) -> ShareLinkResponse:
        source = self._spaces.require_owned_source(owner, source_id)
        existing = self._share_links.get_active_for_source(source_id=str(source_id))
        if existing:
            return ShareLinkResponse(
                token=existing["token"],
                path=_share_path(existing["token"]),
                created_at=existing["created_at"],
            )

        token = secrets.token_urlsafe(32)
        try:
            row = self._share_links.create(
                source_id=str(source_id),
                space_id=source["space_id"],
                token=token,
                created_by=str(owner.id),
            )
        except Exception as exc:  # noqa: BLE001 - race on active-source unique index
            msg = str(exc).lower()
            if "23505" in msg or "violates unique constraint" in msg:
                raced = self._share_links.get_active_for_source(source_id=str(source_id))
                if raced:
                    return ShareLinkResponse(
                        token=raced["token"],
                        path=_share_path(raced["token"]),
                        created_at=raced["created_at"],
                    )
            raise

        return ShareLinkResponse(
            token=row["token"],
            path=_share_path(row["token"]),
            created_at=row["created_at"],
        )

    def revoke_link(self, owner: User, source_id: UUID) -> None:
        self._spaces.require_owned_source(owner, source_id)
        self._share_links.revoke(source_id=str(source_id))

    def redeem_link(self, user: User, token: str) -> RedeemShareLinkResponse:
        link = self._share_links.get_active_by_token(token=token.strip())
        if not link:
            raise NotFoundError("Share link not found.")

        source = self._spaces.get_source_any(UUID(link["source_id"]))
        if not source:
            raise NotFoundError("Share link not found.")

        is_owner = source["user_id"] == str(user.id)
        if not is_owner and not self._collaborators.is_collaborator(
            source_id=source["id"], user_id=str(user.id)
        ):
            try:
                self._collaborators.add(
                    source_id=source["id"],
                    space_id=source["space_id"],
                    user_id=str(user.id),
                    invited_by=link["created_by"],
                )
            except Exception as exc:  # noqa: BLE001 - concurrent redeem is fine
                msg = str(exc).lower()
                if "23505" not in msg and "violates unique constraint" not in msg:
                    raise

        space = self._spaces.get_space_any(UUID(source["space_id"]))
        space_name = (space or {}).get("name") or ""
        owner = self._profiles.get_profile(source["user_id"])

        return RedeemShareLinkResponse(
            source_id=UUID(source["id"]),
            title=source["title"],
            type=source["type"],
            url=source.get("url"),
            author=source.get("author"),
            captured_at=source.get("captured_at"),
            processing_status=source["processing_status"],
            space_id=UUID(source["space_id"]),
            space_name=space_name,
            owner_username=owner.get("username") if owner else None,
            shared_at=link.get("created_at"),
            is_owner=is_owner,
        )
