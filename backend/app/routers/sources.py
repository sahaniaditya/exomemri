"""Source capture routes (thin: delegate to CaptureService)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.dependencies import get_authenticated_app_user, get_capture_service
from app.schemas.common import User
from app.schemas.sources import (
    CaptureRequest,
    CaptureResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.services.capture_service import CaptureService

router = APIRouter(prefix="/sources", tags=["sources"])


@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=CaptureResponse)
async def capture_source(
    body: CaptureRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: CaptureService = Depends(get_capture_service),
) -> CaptureResponse:
    return await svc.capture(user=user, payload=body)


@router.post("/upload-url", response_model=UploadUrlResponse)
async def create_upload_url(
    body: UploadUrlRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: CaptureService = Depends(get_capture_service),
) -> UploadUrlResponse:
    return await svc.create_upload_url(user=user, payload=body)
