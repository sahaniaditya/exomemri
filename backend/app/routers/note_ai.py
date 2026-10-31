"""In-note AI assist route (thin: delegate to NoteAiService)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends

from app.dependencies import enforce_chat_rate_limit, get_note_ai_service
from app.schemas.common import User
from app.schemas.note_ai import NoteAiRequest, NoteAiResponse
from app.services.note_ai_service import NoteAiService

router = APIRouter(prefix="/spaces/{space_id}/notes", tags=["note-ai"])


@router.post("/ai", response_model=NoteAiResponse)
async def note_ai_assist(
    space_id: UUID,
    body: NoteAiRequest,
    user: User = Depends(enforce_chat_rate_limit),
    svc: NoteAiService = Depends(get_note_ai_service),
) -> NoteAiResponse:
    return await svc.assist(user=user, space_id=space_id, payload=body)
