from __future__ import annotations

import json

from app.repositories.storage_repo import StorageRepo
from app.schemas.common import SourceType

EXTRACT_KEY_BY_TYPE = {
    SourceType.youtube: "raw/transcript.json",
    SourceType.article: "raw/extracted.txt",
    SourceType.ai_chat: "raw/chat.json",
    SourceType.note: "raw/note.txt",
    # Assumes a PDF text-extraction step writes this alongside original.pdf.
    # If that doesn't exist yet, pdf summaries will need that step added first.
    SourceType.pdf: "raw/extracted.txt",
}

# Keeps a single inline LLM prompt within a safe context budget. Pipeline
# map-reduce summarize uses ``read_full_extract`` and windows internally.
# Chat's extract fallback still takes the first window via ``read_extract``.
MAX_EXTRACT_CHARS = 40_000


class ExtractService:
    def __init__(self, storage: StorageRepo) -> None:
        self._storage = storage

    async def read_extract(self, source: dict) -> str:
        return (await self.read_full_extract(source))[:MAX_EXTRACT_CHARS]

    async def read_full_extract(self, source: dict) -> str:
        """Untruncated text for chunking and map-reduce LLM stages.

        Prefer this for the pipeline (full document → chunk/embed; LLM stages
        window internally). Use ``read_extract`` only for a single bounded call.
        """
        source_type = SourceType(source["type"])
        key = EXTRACT_KEY_BY_TYPE[source_type]
        path = f"{source['storage_prefix']}/{key}"
        raw = await self._storage.download_text(path)
        return self._parse(source_type, raw)

    def _parse(self, source_type: SourceType, raw: str) -> str:
        # transcript.json / chat.json are structured JSON, not plain text —
        # adjust these two branches to match your actual capture shape.
        if source_type is SourceType.youtube:
            data = json.loads(raw)
            segments = data if isinstance(data, list) else data.get("segments", [])
            return " ".join(seg.get("text", "") for seg in segments)
        if source_type is SourceType.ai_chat:
            data = json.loads(raw)
            turns = data if isinstance(data, list) else data.get("messages", [])
            return "\n\n".join(f"{t.get('role', '?')}: {t.get('content', '')}" for t in turns)
        return raw  # article/note/pdf extracts are already plain text