"""Notes workspace routes: tree, trash, search, page patching, export and links."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.dependencies import get_authenticated_app_user, get_note_workspace_service
from app.schemas.common import User
from app.schemas.note_workspace import (
    CreateWorkspacePageRequest,
    NoteLinksResponse,
    NoteSearchResponse,
    NoteTrashResponse,
    NoteTreeResponse,
    PatchNotePageRequest,
    WorkspacePageResponse,
)
from app.services.note_workspace_service import NoteWorkspaceService

router = APIRouter(prefix="/spaces", tags=["note-workspace"])

_BASE = "/{space_id}/notes"

# Static paths are declared before the ``/{note_id}`` routes so they win the match.


@router.get(f"{_BASE}/tree", response_model=NoteTreeResponse)
def get_note_tree(
    space_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteWorkspaceService = Depends(get_note_workspace_service),
) -> NoteTreeResponse:
    return svc.tree(user, space_id)


@router.get(f"{_BASE}/trash", response_model=NoteTrashResponse)
def list_note_trash(
    space_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteWorkspaceService = Depends(get_note_workspace_service),
) -> NoteTrashResponse:
    return svc.trash(user, space_id)


@router.delete(f"{_BASE}/trash/{{note_id}}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trashed_note(
    space_id: UUID,
    note_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteWorkspaceService = Depends(get_note_workspace_service),
) -> None:
    svc.delete_trashed(user, space_id, note_id)


@router.get(f"{_BASE}/search", response_model=NoteSearchResponse)
def search_notes(
    space_id: UUID,
    q: str = Query(..., min_length=1, max_length=100),
    user: User = Depends(get_authenticated_app_user),
    svc: NoteWorkspaceService = Depends(get_note_workspace_service),
) -> NoteSearchResponse:
    return svc.search(user, space_id, q)


@router.post(
    f"{_BASE}/pages",
    status_code=status.HTTP_201_CREATED,
    response_model=WorkspacePageResponse,
)
def create_workspace_note(
    space_id: UUID,
    body: CreateWorkspacePageRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteWorkspaceService = Depends(get_note_workspace_service),
) -> WorkspacePageResponse:
    return svc.create_page(user, space_id, body)


@router.get(f"{_BASE}/{{note_id}}", response_model=WorkspacePageResponse)
def get_workspace_note(
    space_id: UUID,
    note_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteWorkspaceService = Depends(get_note_workspace_service),
) -> WorkspacePageResponse:
    return svc.get_page(user, space_id, note_id)


@router.patch(f"{_BASE}/{{note_id}}", response_model=WorkspacePageResponse)
def patch_workspace_note(
    space_id: UUID,
    note_id: UUID,
    body: PatchNotePageRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteWorkspaceService = Depends(get_note_workspace_service),
) -> WorkspacePageResponse:
    return svc.patch_page(user, space_id, note_id, body)


@router.post(f"{_BASE}/{{note_id}}/trash", status_code=status.HTTP_204_NO_CONTENT)
def trash_workspace_note(
    space_id: UUID,
    note_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteWorkspaceService = Depends(get_note_workspace_service),
) -> None:
    svc.trash_page(user, space_id, note_id)


@router.post(f"{_BASE}/{{note_id}}/restore", response_model=WorkspacePageResponse)
def restore_workspace_note(
    space_id: UUID,
    note_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteWorkspaceService = Depends(get_note_workspace_service),
) -> WorkspacePageResponse:
    return svc.restore_page(user, space_id, note_id)


@router.post(
    f"{_BASE}/{{note_id}}/duplicate",
    status_code=status.HTTP_201_CREATED,
    response_model=WorkspacePageResponse,
)
def duplicate_workspace_note(
    space_id: UUID,
    note_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteWorkspaceService = Depends(get_note_workspace_service),
) -> WorkspacePageResponse:
    return svc.duplicate_page(user, space_id, note_id)


@router.get(f"{_BASE}/{{note_id}}/export.md", response_class=Response)
def export_workspace_note(
    space_id: UUID,
    note_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteWorkspaceService = Depends(get_note_workspace_service),
) -> Response:
    filename, markdown = svc.export_markdown(user, space_id, note_id)
    return Response(
        content=markdown,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(f"{_BASE}/{{note_id}}/links", response_model=NoteLinksResponse)
def get_workspace_note_links(
    space_id: UUID,
    note_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteWorkspaceService = Depends(get_note_workspace_service),
) -> NoteLinksResponse:
    return svc.links(user, space_id, note_id)
