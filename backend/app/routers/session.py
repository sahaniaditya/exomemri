"""Session routes (thin: no business logic)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.dependencies import get_authenticated_app_user, get_session_service
from app.schemas.common import User
from app.schemas.session import SessionResponse, SetActiveSpaceRequest
from app.services.session_service import SessionService

router = APIRouter(tags=["session"])


@router.get("/session", response_model=SessionResponse)
def get_session(
    user: User = Depends(get_authenticated_app_user),
    svc: SessionService = Depends(get_session_service),
) -> SessionResponse:
    return svc.get_session(user)


@router.post("/session/active", status_code=status.HTTP_204_NO_CONTENT)
def set_active_space(
    body: SetActiveSpaceRequest,
    user: User = Depends(get_authenticated_app_user),
    svc: SessionService = Depends(get_session_service),
) -> None:
    svc.set_active_space(user, body.space_id)
