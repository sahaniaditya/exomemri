"""User-triggered AI assist inside a space note.

Runs only on an explicit user action. Metered exactly like Ask (``consume_ask`` with a
``rollback_ask`` on any failure). Note text is never logged or persisted.
"""

from __future__ import annotations

import logging
from functools import partial
from uuid import UUID

import anyio

from app.errors import NotFoundError
from app.repositories.space_note_repo import SpaceNoteRepo
from app.schemas.common import User
from app.schemas.note_ai import NoteAiRequest, NoteAiResponse
from app.services.credits_service import CreditsService
from app.services.llm_service import LLMService
from app.services.space_service import SpaceService

logger = logging.getLogger(__name__)


class NoteAiService:
    def __init__(
        self,
        spaces: SpaceService,
        space_notes: SpaceNoteRepo,
        llm: LLMService,
        credits: CreditsService,
    ) -> None:
        self._spaces = spaces
        self._space_notes = space_notes
        self._llm = llm
        self._credits = credits

    async def assist(
        self, *, user: User, space_id: UUID, payload: NoteAiRequest
    ) -> NoteAiResponse:
        await anyio.to_thread.run_sync(
            partial(self._spaces.require_owned_space, user, space_id)
        )
        if payload.note_id is not None:
            note = await anyio.to_thread.run_sync(
                partial(
                    self._space_notes.get,
                    space_id=str(space_id),
                    note_id=str(payload.note_id),
                    user_id=str(user.id),
                )
            )
            if not note:
                raise NotFoundError(
                    "Note page not found.", detail={"note_id": str(payload.note_id)}
                )
        charge = await anyio.to_thread.run_sync(
            partial(self._credits.consume_ask, str(user.id))
        )
        try:
            text = await self._llm.note_assist(
                action=payload.action, text=payload.text, instruction=payload.instruction
            )
        except Exception:  # noqa: BLE001 - roll back ask metering before propagating
            await anyio.to_thread.run_sync(
                partial(self._credits.rollback_ask, str(user.id), charge)
            )
            raise
        logger.info(
            "note_ai_assist",
            extra={
                "space_id": str(space_id),
                "action": payload.action,
                "input_chars": len(payload.text),
                "output_chars": len(text),
            },
        )
        return NoteAiResponse(text=text)
