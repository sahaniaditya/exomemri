"""Keeps ``content_text`` and ``note_links`` in step with a note's TipTap JSON."""

from __future__ import annotations

import logging
from typing import Any

from app.repositories.note_workspace_repo import NoteWorkspaceRepo
from app.services.note_text import extract_links, extract_text

logger = logging.getLogger(__name__)


class NoteIndexService:
    def __init__(self, repo: NoteWorkspaceRepo) -> None:
        self._repo = repo

    def refresh(self, *, user_id: str, note_id: str, content: Any) -> bool:
        """Re-index one note. Never raises: an indexing failure must not fail a save."""
        try:
            text = extract_text(content)
            links = [link for link in extract_links(content) if link != ("note", note_id)]
            self._repo.set_content_text(note_id=note_id, user_id=user_id, text=text)
            self._repo.replace_links(note_id=note_id, user_id=user_id, links=links)
        except Exception:  # noqa: BLE001 - search/link indexing is best-effort by design
            logger.warning("note_index_failed", extra={"note_id": note_id}, exc_info=True)
            return False
        return True
