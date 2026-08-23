"""Source capture routes (thin: delegate to CaptureService)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, status

from app.dependencies import (
    get_authenticated_app_user,
    get_capture_service,
    get_note_service,
    get_pipeline_service,
    get_source_chat_service,
    get_space_service,
)
from app.schemas.common import User
from app.schemas.notes import (
    NoteImageUploadRequest,
    NoteImageUploadResponse,
    NoteResponse,
    UpsertNoteRequest,
)
from app.schemas.sources import (
    CaptureRequest,
    CaptureResponse,
    MessageListResponse,
    SendMessageRequest,
    SendMessageResponse,
    SummaryResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.schemas.spaces import (
    ArtifactUrlResponse,
    SetSourceFolderRequest,
    SourceListResponse,
    SourceSummary,
)
from app.services.capture_service import CaptureService
from app.services.note_service import NoteService
from app.services.pipeline_service import PipelineService
from app.services.source_chat_service import SourceChatService
from app.services.space_service import SpaceService

router = APIRouter(prefix="/sources", tags=["sources"])


@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=CaptureResponse)
async def capture_source(
    body: CaptureRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_authenticated_app_user),
    svc: CaptureService = Depends(get_capture_service),
    pipeline: PipelineService = Depends(get_pipeline_service),
) -> CaptureResponse:
    result = await svc.capture(user=user, payload=body)
    # Fired after the response is sent — capture itself never calls an LLM.
    background_tasks.add_task(
        pipeline.run, user=user, source_id=result.source_id, space_id=body.space_id
    )
    return result


@router.post("/upload-url", response_model=UploadUrlResponse)
async def create_upload_url(
    body: UploadUrlRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: CaptureService = Depends(get_capture_service),
) -> UploadUrlResponse:
    return await svc.create_upload_url(user=user, payload=body)


@router.get("", response_model=SourceListResponse)
def list_sources(
    limit: int = Query(default=20, ge=1, le=200),
    user: User = Depends(get_authenticated_app_user),
    svc: SpaceService = Depends(get_space_service),
) -> SourceListResponse:
    """Recent captures across every space — the dashboard's capture feed."""
    return SourceListResponse(sources=svc.list_sources(user, limit=limit))


@router.get("/{source_id}/artifact-url", response_model=ArtifactUrlResponse)
async def get_artifact_url(
    source_id: UUID,
    key: str = Query(default="raw/meta.json"),
    user: User = Depends(get_authenticated_app_user),
    svc: CaptureService = Depends(get_capture_service),
) -> ArtifactUrlResponse:
    return await svc.artifact_url(user=user, source_id=source_id, key=key)

@router.get("/{source_id}/summary", response_model=SummaryResponse)
async def get_summary(
    source_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: SourceChatService = Depends(get_source_chat_service),
) -> SummaryResponse:
    return await svc.get_or_create_summary(user=user, source_id=source_id)

@router.get("/{source_id}/messages", response_model=MessageListResponse)
async def get_messages(
    source_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: SourceChatService = Depends(get_source_chat_service),
) -> MessageListResponse:
    return await svc.list_messages(user=user, source_id=source_id)

@router.post("/{source_id}/messages", response_model=SendMessageResponse)
async def post_message(
    source_id: UUID,
    body: SendMessageRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: SourceChatService = Depends(get_source_chat_service),
) -> SendMessageResponse:
    return await svc.send_message(user=user, source_id=source_id, content=body.content)


@router.get("/{source_id}/notes", response_model=NoteResponse)
async def get_note(
    source_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteService = Depends(get_note_service),
) -> NoteResponse:
    return await svc.get_note(user=user, source_id=source_id)


@router.put("/{source_id}/notes", response_model=NoteResponse)
async def put_note(
    source_id: UUID,
    body: UpsertNoteRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteService = Depends(get_note_service),
) -> NoteResponse:
    return await svc.upsert_note(user=user, source_id=source_id, payload=body)


@router.post("/{source_id}/note-images", response_model=NoteImageUploadResponse)
async def create_note_image_upload(
    source_id: UUID,
    body: NoteImageUploadRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: NoteService = Depends(get_note_service),
) -> NoteImageUploadResponse:
    return await svc.create_image_upload(user=user, source_id=source_id, payload=body)


@router.patch("/{source_id}/folder", response_model=SourceSummary)
def set_source_folder(
    source_id: UUID,
    body: SetSourceFolderRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: SpaceService = Depends(get_space_service),
) -> SourceSummary:
    return svc.set_source_folder(user, source_id, body.folder_id)


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_source(
    source_id: UUID,
    user: User = Depends(get_authenticated_app_user),
    svc: CaptureService = Depends(get_capture_service),
) -> None:
    await svc.delete(user=user, source_id=source_id)

