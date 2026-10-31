"""Schemas for user-triggered AI assist inside a note."""

from __future__ import annotations

from typing import Literal, Self
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

MAX_ASSIST_TEXT_LENGTH = 8000
MAX_ASSIST_INSTRUCTION_LENGTH = 500

NoteAssistAction = Literal["summarize", "rewrite", "expand", "continue", "ask"]


class NoteAiRequest(BaseModel):
    action: NoteAssistAction
    text: str = Field(min_length=1, max_length=MAX_ASSIST_TEXT_LENGTH)
    instruction: str | None = Field(default=None, max_length=MAX_ASSIST_INSTRUCTION_LENGTH)
    note_id: UUID | None = None

    @field_validator("text")
    @classmethod
    def _text_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text must not be blank")
        return value

    @field_validator("instruction")
    @classmethod
    def _blank_instruction_is_none(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            return None
        return value

    @model_validator(mode="after")
    def _ask_needs_instruction(self) -> Self:
        if self.action == "ask" and not self.instruction:
            raise ValueError("instruction is required for the ask action")
        return self


class NoteAiResponse(BaseModel):
    text: str
