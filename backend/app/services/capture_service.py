"""Capture orchestration (Phase 0).

Mints the ``source_id``, builds the per-user storage key, recomputes the
authoritative ``content_hash``, writes the raw artifact(s) to Supabase
Storage, and returns the capture acknowledgement. No Postgres, no queue.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from uuid import UUID, uuid4

from app.config import Settings
from app.errors import ValidationError
from app.repositories.storage_repo import StorageRepo
from app.schemas.common import ProcessingStatus, SourceType, User
from app.schemas.sources import (
    CaptureRequest,
    CaptureResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)

logger = logging.getLogger(__name__)


def compute_content_hash(content: str | None, url: str | None) -> str:
    """SHA-256 over the captured content, or the URL when content is absent.

    This mirrors ``extension/src/lib/hash.ts`` so the client- and server-side
    hashes agree; it is the idempotency key used from Phase 1 onward.
    """
    basis = content if content else (url or "")
    return hashlib.sha256(basis.encode("utf-8")).hexdigest()


def build_source_prefix(user_id: UUID, space_id: UUID, source_id: UUID) -> str:
    return f"users/{user_id}/spaces/{space_id}/sources/{source_id}"


class CaptureService:
    def __init__(self, settings: Settings, storage: StorageRepo) -> None:
        self._settings = settings
        self._storage = storage

    async def _write_meta(
        self,
        prefix: str,
        *,
        user: User,
        source_id: UUID,
        space_id: UUID,
        source_type: SourceType,
        title: str,
        url: str | None,
        author: str | None,
        content_hash: str,
        captured_at: str,
    ) -> None:
        meta = {
            "user_id": str(user.id),
            "space_id": str(space_id),
            "source_id": str(source_id),
            "type": source_type.value,
            "title": title,
            "url": url,
            "author": author,
            "content_hash": content_hash,
            "captured_at": captured_at,
        }
        await self._storage.upload_text(
            f"{prefix}/raw/meta.json",
            json.dumps(meta, ensure_ascii=False, indent=2),
            "application/json",
        )

    async def capture(self, *, user: User, payload: CaptureRequest) -> CaptureResponse:
        if payload.type is SourceType.pdf:
            # PDFs must go through the pre-signed upload flow.
            raise ValidationError(
                "PDF sources must use POST /v1/sources/upload-url",
                detail={"type": "pdf"},
            )

        source_id = uuid4()
        url_str = str(payload.url) if payload.url else None
        content_hash = compute_content_hash(payload.content, url_str)
        if payload.content_hash and payload.content_hash != content_hash:
            logger.warning(
                "content_hash_mismatch",
                extra={"client_hash": payload.content_hash, "server_hash": content_hash},
            )

        prefix = build_source_prefix(user.id, payload.space_id, source_id)
        captured_at = datetime.now(UTC).isoformat()

        await self._write_meta(
            prefix,
            user=user,
            source_id=source_id,
            space_id=payload.space_id,
            source_type=payload.type,
            title=payload.title,
            url=url_str,
            author=payload.author,
            content_hash=content_hash,
            captured_at=captured_at,
        )
        await self._write_artifacts(prefix, payload)

        logger.info(
            "source_captured",
            extra={
                "source_id": str(source_id),
                "space_id": str(payload.space_id),
                "type": payload.type.value,
            },
        )
        return CaptureResponse(source_id=source_id, processing_status=ProcessingStatus.queued)

    async def _write_artifacts(self, prefix: str, payload: CaptureRequest) -> None:
        content = payload.content or ""
        if payload.type is SourceType.youtube:
            await self._storage.upload_text(
                f"{prefix}/raw/transcript.json", content, "application/json"
            )
        elif payload.type is SourceType.ai_chat:
            await self._storage.upload_text(
                f"{prefix}/raw/chat.json", content, "application/json"
            )
        elif payload.type is SourceType.article:
            if payload.raw_html:
                await self._storage.upload_text(
                    f"{prefix}/raw/page.html", payload.raw_html, "text/html; charset=utf-8"
                )
            await self._storage.upload_text(
                f"{prefix}/raw/extracted.txt", content, "text/plain; charset=utf-8"
            )
        elif payload.type is SourceType.note:
            await self._storage.upload_text(
                f"{prefix}/raw/note.txt", content, "text/plain; charset=utf-8"
            )

    async def create_upload_url(
        self, *, user: User, payload: UploadUrlRequest
    ) -> UploadUrlResponse:
        source_id = uuid4()
        url_str = str(payload.url) if payload.url else None
        content_hash = payload.content_hash or compute_content_hash(None, url_str)
        prefix = build_source_prefix(user.id, payload.space_id, source_id)
        captured_at = datetime.now(UTC).isoformat()

        await self._write_meta(
            prefix,
            user=user,
            source_id=source_id,
            space_id=payload.space_id,
            source_type=SourceType.pdf,
            title=payload.title,
            url=url_str,
            author=payload.author,
            content_hash=content_hash,
            captured_at=captured_at,
        )

        object_path = f"{prefix}/original.pdf"
        signed = await self._storage.create_signed_upload_url(object_path)
        upload_url = self._absolute_upload_url(signed["signed_url"])

        return UploadUrlResponse(
            source_id=source_id,
            processing_status=ProcessingStatus.queued,
            upload_url=upload_url,
            token=signed["token"],
            path=object_path,
        )

    def _absolute_upload_url(self, signed_url: str) -> str:
        base = self._settings.supabase_url.rstrip("/")
        if signed_url.startswith("http"):
            return signed_url
        if signed_url.startswith("/storage/v1"):
            return f"{base}{signed_url}"
        return f"{base}/storage/v1{signed_url if signed_url.startswith('/') else '/' + signed_url}"
