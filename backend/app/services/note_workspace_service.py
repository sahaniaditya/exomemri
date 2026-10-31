"""Notes workspace: page tree, trash, search, duplicate, export and capture links."""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from app.errors import ConflictError, NotFoundError, ValidationError
from app.repositories.note_workspace_repo import NoteWorkspaceRepo
from app.schemas.common import User
from app.schemas.note_workspace import (
    MAX_WORKSPACE_PAGES,
    SEARCH_RESULT_LIMIT,
    TRASH_RETENTION_DAYS,
    CreateWorkspacePageRequest,
    IncomingNoteLink,
    NoteLinksResponse,
    NoteSearchHit,
    NoteSearchResponse,
    NoteTrashItem,
    NoteTrashResponse,
    NoteTreeItem,
    NoteTreeResponse,
    OutgoingNoteLink,
    PatchNotePageRequest,
    WorkspacePageResponse,
)
from app.schemas.notes import DEFAULT_NOTE_TITLE, MAX_NOTE_TITLE_LENGTH
from app.services.capture_service import is_note_image_key
from app.services.note_index_service import NoteIndexService
from app.services.note_service import EMPTY_DOC
from app.services.note_text import to_markdown
from app.services.space_service import SpaceService

logger = logging.getLogger(__name__)

COPY_SUFFIX = " (copy)"
SNIPPET_RADIUS = 60
# Fields whose change bumps ``updated_at`` (the optimistic-concurrency token).
# Moving or reordering a page does not, so it never invalidates an open editor.
_CONTENT_FIELDS = ("title", "content", "icon", "cover_key", "full_width")


def parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def make_snippet(text: str, term: str) -> str:
    """A short excerpt of ``text`` around the first occurrence of ``term``."""
    flat = " ".join(text.split())
    if not flat:
        return ""
    index = flat.lower().find(term.lower().strip())
    if index < 0:
        words = [w for w in term.lower().split() if w]
        index = min((i for i in (flat.lower().find(w) for w in words) if i >= 0), default=0)
    start = max(0, index - SNIPPET_RADIUS // 2)
    end = min(len(flat), start + SNIPPET_RADIUS * 2)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(flat) else ""
    return f"{prefix}{flat[start:end]}{suffix}"


def export_filename(title: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", title).strip("-").lower()
    return f"{slug or 'note'}.md"


class NoteWorkspaceService:
    def __init__(
        self,
        spaces: SpaceService,
        repo: NoteWorkspaceRepo,
        indexer: NoteIndexService,
    ) -> None:
        self._spaces = spaces
        self._repo = repo
        self._indexer = indexer

    # --- reads -------------------------------------------------------------

    def tree(self, user: User, space_id: UUID) -> NoteTreeResponse:
        self._spaces.require_owned_space(user, space_id)
        rows = self._repo.list_active(space_id=str(space_id), user_id=str(user.id))
        return NoteTreeResponse(items=[self._tree_item(row) for row in rows])

    def trash(self, user: User, space_id: UUID) -> NoteTrashResponse:
        self._spaces.require_owned_space(user, space_id)
        space, owner = str(space_id), str(user.id)
        cutoff = datetime.now(UTC) - timedelta(days=TRASH_RETENTION_DAYS)
        self._repo.purge_trashed_before(space_id=space, user_id=owner, cutoff=cutoff.isoformat())
        rows = self._repo.list_trashed(space_id=space, user_id=owner)
        return NoteTrashResponse(
            items=[
                NoteTrashItem(
                    id=UUID(str(row["id"])),
                    title=row["title"],
                    icon=row.get("icon"),
                    parent_id=row.get("parent_id"),
                    deleted_at=row.get("deleted_at"),
                )
                for row in rows
            ]
        )

    def get_page(self, user: User, space_id: UUID, note_id: UUID) -> WorkspacePageResponse:
        self._spaces.require_owned_space(user, space_id)
        return self._page(self._live(user, space_id, note_id))

    def search(self, user: User, space_id: UUID, query: str) -> NoteSearchResponse:
        self._spaces.require_owned_space(user, space_id)
        term = query.strip()
        space, owner = str(space_id), str(user.id)
        hits: dict[str, dict] = {}

        def collect(rows: list[dict]) -> None:
            for row in rows:
                hits.setdefault(str(row["id"]), row)

        if term:
            collect(
                self._repo.search_fulltext(
                    space_id=space, user_id=owner, query=term, limit=SEARCH_RESULT_LIMIT
                )
            )
            for column in ("title", "content_text"):
                if len(hits) >= SEARCH_RESULT_LIMIT:
                    break
                collect(
                    self._repo.search_partial(
                        space_id=space,
                        user_id=owner,
                        term=term,
                        column=column,
                        limit=SEARCH_RESULT_LIMIT,
                    )
                )
        ranked = list(hits.values())[:SEARCH_RESULT_LIMIT]
        return NoteSearchResponse(
            items=[
                NoteSearchHit(
                    id=UUID(str(row["id"])),
                    title=row["title"],
                    icon=row.get("icon"),
                    snippet=make_snippet(row.get("content_text") or "", term),
                )
                for row in ranked
            ]
        )

    def export_markdown(self, user: User, space_id: UUID, note_id: UUID) -> tuple[str, str]:
        self._spaces.require_owned_space(user, space_id)
        row = self._live(user, space_id, note_id)
        title = row["title"]
        return export_filename(title), to_markdown(row.get("content") or EMPTY_DOC, title)

    def links(self, user: User, space_id: UUID, note_id: UUID) -> NoteLinksResponse:
        self._spaces.require_owned_space(user, space_id)
        self._live(user, space_id, note_id)
        owner, note = str(user.id), str(note_id)
        raw = self._repo.list_outgoing_links(note_id=note, user_id=owner)
        source_ids = [str(r["target_id"]) for r in raw if r["target_type"] == "source"]
        note_ids = [str(r["target_id"]) for r in raw if r["target_type"] == "note"]
        outgoing = [
            OutgoingNoteLink(type="source", id=UUID(str(s["id"])), title=s["title"] or "")
            for s in self._repo.get_sources(user_id=owner, source_ids=source_ids)
        ]
        outgoing += [
            OutgoingNoteLink(type="note", id=UUID(str(n["id"])), title=n["title"])
            for n in self._visible_notes(owner, str(space_id), note_ids)
            if str(n["id"]) != note
        ]
        outgoing.sort(key=lambda link: (link.type, link.title.lower()))
        incoming_ids = self._repo.list_incoming_note_ids(note_id=note, user_id=owner)
        incoming = [
            IncomingNoteLink(id=UUID(str(n["id"])), title=n["title"], icon=n.get("icon"))
            for n in self._visible_notes(owner, str(space_id), incoming_ids)
            if str(n["id"]) != note
        ]
        incoming.sort(key=lambda link: link.title.lower())
        return NoteLinksResponse(outgoing=outgoing, incoming=incoming)

    # --- writes ------------------------------------------------------------

    def create_page(
        self, user: User, space_id: UUID, payload: CreateWorkspacePageRequest
    ) -> WorkspacePageResponse:
        self._spaces.require_owned_space(user, space_id)
        rows = self._repo.list_active(space_id=str(space_id), user_id=str(user.id))
        self._require_capacity(rows)
        parent = str(payload.parent_id) if payload.parent_id else None
        self._require_parent(rows, parent, note_id=None)
        row = self._repo.insert(
            {
                "id": str(uuid4()),
                "space_id": str(space_id),
                "user_id": str(user.id),
                "title": payload.title,
                "content": EMPTY_DOC,
                "parent_id": parent,
                "sort_order": self._next_sort_order(rows, parent),
            }
        )
        logger.info(
            "workspace_note_created", extra={"space_id": str(space_id), "note_id": row["id"]}
        )
        return self._page(row)

    def patch_page(
        self, user: User, space_id: UUID, note_id: UUID, payload: PatchNotePageRequest
    ) -> WorkspacePageResponse:
        self._spaces.require_owned_space(user, space_id)
        row = self._live(user, space_id, note_id)
        self._check_conflict(row, payload.expected_updated_at)
        fields = payload.model_fields_set - {"expected_updated_at"}
        patch: dict = {}
        for name in ("title", "content", "icon", "full_width"):
            if name in fields:
                patch[name] = getattr(payload, name)
        if "cover_key" in fields:
            patch["cover_key"] = self._clean_cover_key(payload.cover_key)
        patch.update(self._placement_patch(user, space_id, row, payload, fields))
        touch = any(name in fields for name in _CONTENT_FIELDS)
        if not patch:
            return self._page(row)
        updated = self._repo.update(
            space_id=str(space_id),
            note_id=str(note_id),
            user_id=str(user.id),
            patch=patch,
            touch=touch,
        )
        if not updated:
            raise self._not_found(note_id)
        if "content" in fields:
            self._indexer.refresh(
                user_id=str(user.id), note_id=str(note_id), content=payload.content
            )
        return self._page(updated)

    def trash_page(self, user: User, space_id: UUID, note_id: UUID) -> None:
        self._spaces.require_owned_space(user, space_id)
        self._live(user, space_id, note_id)
        self._repo.trash_tree(
            space_id=str(space_id),
            note_id=str(note_id),
            user_id=str(user.id),
            deleted_at=datetime.now(UTC).isoformat(),
        )
        logger.info("workspace_note_trashed", extra={"note_id": str(note_id)})

    def restore_page(self, user: User, space_id: UUID, note_id: UUID) -> WorkspacePageResponse:
        self._spaces.require_owned_space(user, space_id)
        row = self._require(user, space_id, note_id)
        deleted_at = row.get("deleted_at")
        if not deleted_at:
            raise self._not_found(note_id)
        parent_id = row.get("parent_id")
        parent_alive = False
        if parent_id:
            parent = self._repo.get(
                space_id=str(space_id), note_id=str(parent_id), user_id=str(user.id)
            )
            parent_alive = bool(parent and not parent.get("deleted_at"))
        self._repo.restore_tree(
            space_id=str(space_id),
            note_id=str(note_id),
            user_id=str(user.id),
            deleted_at=str(deleted_at),
            to_root=bool(parent_id) and not parent_alive,
        )
        logger.info("workspace_note_restored", extra={"note_id": str(note_id)})
        return self._page(self._require(user, space_id, note_id))

    def duplicate_page(
        self, user: User, space_id: UUID, note_id: UUID
    ) -> WorkspacePageResponse:
        self._spaces.require_owned_space(user, space_id)
        source = self._live(user, space_id, note_id)
        rows = self._repo.list_active(space_id=str(space_id), user_id=str(user.id))
        self._require_capacity(rows)
        parent = source.get("parent_id")
        parent = str(parent) if parent else None
        title = source["title"][: MAX_NOTE_TITLE_LENGTH - len(COPY_SUFFIX)] + COPY_SUFFIX
        content = source.get("content") or EMPTY_DOC
        row = self._repo.insert(
            {
                "id": str(uuid4()),
                "space_id": str(space_id),
                "user_id": str(user.id),
                "title": title,
                "content": content,
                "icon": source.get("icon"),
                "cover_key": source.get("cover_key"),
                "full_width": bool(source.get("full_width")),
                "parent_id": parent,
                "sort_order": self._next_sort_order(rows, parent),
                "content_text": source.get("content_text") or "",
            }
        )
        self._indexer.refresh(user_id=str(user.id), note_id=str(row["id"]), content=content)
        return self._page(row)

    def delete_trashed(self, user: User, space_id: UUID, note_id: UUID) -> None:
        self._spaces.require_owned_space(user, space_id)
        row = self._require(user, space_id, note_id)
        if not row.get("deleted_at"):
            raise self._not_found(note_id)
        self._repo.delete_trashed(
            space_id=str(space_id), note_id=str(note_id), user_id=str(user.id)
        )
        logger.info("workspace_note_purged", extra={"note_id": str(note_id)})

    # --- helpers -----------------------------------------------------------

    def _require(self, user: User, space_id: UUID, note_id: UUID) -> dict:
        row = self._repo.get(
            space_id=str(space_id), note_id=str(note_id), user_id=str(user.id)
        )
        if not row:
            raise self._not_found(note_id)
        return row

    def _live(self, user: User, space_id: UUID, note_id: UUID) -> dict:
        row = self._require(user, space_id, note_id)
        if row.get("deleted_at"):
            raise self._not_found(note_id)
        return row

    @staticmethod
    def _not_found(note_id: UUID) -> NotFoundError:
        return NotFoundError("Note page not found.", detail={"note_id": str(note_id)})

    @staticmethod
    def _check_conflict(row: dict, expected: str | None) -> None:
        if expected is None:
            return
        current = row.get("updated_at")
        want, have = parse_timestamp(expected), parse_timestamp(current)
        same = want == have if want and have else expected == current
        if not same:
            raise ConflictError(
                "This note was changed elsewhere.",
                detail={"code": "note_conflict", "updated_at": current},
            )

    @staticmethod
    def _clean_cover_key(key: str | None) -> str | None:
        if key is None:
            return None
        clean = key.strip().strip("/")
        if not is_note_image_key(clean):
            raise ValidationError("Invalid note image key.", detail={"key": key})
        return clean

    @staticmethod
    def _require_capacity(rows: list[dict]) -> None:
        if len(rows) >= MAX_WORKSPACE_PAGES:
            raise ConflictError(
                "This space already has the maximum number of note pages.",
                detail={"max": MAX_WORKSPACE_PAGES},
            )

    @staticmethod
    def _require_parent(rows: list[dict], parent_id: str | None, *, note_id: str | None) -> None:
        """Parent must be a live root page of this space; a page with children stays a root."""
        if parent_id is None:
            return
        if parent_id == note_id:
            raise ValidationError("A page cannot be its own parent.")
        parent = next((r for r in rows if str(r["id"]) == parent_id), None)
        if parent is None:
            raise ValidationError("Parent page not found in this space.")
        if parent.get("parent_id"):
            raise ValidationError(
                "Pages can only be nested one level deep.", detail={"parent_id": parent_id}
            )
        if note_id and any(str(r.get("parent_id") or "") == note_id for r in rows):
            raise ValidationError(
                "A page that has sub-pages cannot be moved under another page.",
                detail={"note_id": note_id},
            )

    @staticmethod
    def _next_sort_order(rows: list[dict], parent_id: str | None) -> int:
        siblings = [
            int(r["sort_order"])
            for r in rows
            if (str(r["parent_id"]) if r.get("parent_id") else None) == parent_id
        ]
        return max(siblings) + 1 if siblings else 0

    def _placement_patch(
        self,
        user: User,
        space_id: UUID,
        row: dict,
        payload: PatchNotePageRequest,
        fields: set[str],
    ) -> dict:
        """Validated ``parent_id``/``sort_order`` changes for a patch."""
        patch: dict = {}
        current_parent = str(row["parent_id"]) if row.get("parent_id") else None
        if "parent_id" in fields:
            target = str(payload.parent_id) if payload.parent_id else None
            if target != current_parent:
                rows = self._repo.list_active(space_id=str(space_id), user_id=str(user.id))
                self._require_parent(rows, target, note_id=str(row["id"]))
                patch["parent_id"] = target
                if "sort_order" not in fields:
                    patch["sort_order"] = self._next_sort_order(rows, target)
        if "sort_order" in fields:
            patch["sort_order"] = payload.sort_order
        return patch

    def _visible_notes(self, owner: str, space_id: str, note_ids: list[str]) -> list[dict]:
        return [
            n
            for n in self._repo.get_many(user_id=owner, note_ids=note_ids)
            if not n.get("deleted_at") and str(n.get("space_id")) == space_id
        ]

    @staticmethod
    def _tree_item(row: dict) -> NoteTreeItem:
        return NoteTreeItem(
            id=UUID(str(row["id"])),
            title=row["title"],
            icon=row.get("icon"),
            parent_id=row.get("parent_id"),
            sort_order=int(row["sort_order"]),
            updated_at=row.get("updated_at"),
        )

    @staticmethod
    def _page(row: dict) -> WorkspacePageResponse:
        return WorkspacePageResponse(
            id=UUID(str(row["id"])),
            space_id=UUID(str(row["space_id"])),
            title=row["title"] or DEFAULT_NOTE_TITLE,
            content=row.get("content") or EMPTY_DOC,
            icon=row.get("icon"),
            cover_key=row.get("cover_key"),
            full_width=bool(row.get("full_width")),
            parent_id=row.get("parent_id"),
            sort_order=int(row["sort_order"]),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )
