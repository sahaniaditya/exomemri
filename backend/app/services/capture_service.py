"""Capture orchestration.

Authorizes the target space, mints the ``source_id``, builds the per-user
storage key, recomputes the authoritative ``content_hash``, writes the raw
artifact(s) to Supabase Storage, then records the ``sources`` row. No queue yet.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from functools import partial
from uuid import UUID, uuid4

import anyio

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
from app.schemas.spaces import ArtifactUrlResponse
from app.services.space_service import SpaceService

logger = logging.getLogger(__name__)

# Signed artifact URLs are meant to be consumed by the page that asked for them.
ARTIFACT_URL_TTL_SECONDS = 300

# Artifact keys the capture flow can produce, relative to a source's prefix.
ALLOWED_ARTIFACT_KEYS = frozenset(
    {
        "raw/meta.json",
        "raw/transcript.json",
        "raw/chat.json",
        "raw/page.html",
        "raw/extracted.txt",
        "raw/note.txt",
        "original.pdf",
    }
)


def _validated_artifact_key(key: str) -> str:
    """Guard the object key against traversal and against probing the bucket.

    An allowlist rather than sanitization: the capture flow writes a known,
    closed set of keys, so anything else is a bug or an attempt to walk the
    bucket with someone else's prefix.
    """
    clean = key.strip().lstrip("/")
    if clean not in ALLOWED_ARTIFACT_KEYS:
        raise ValidationError(
            "Unknown artifact key.",
            detail={"key": key, "allowed": sorted(ALLOWED_ARTIFACT_KEYS)},
        )
    return clean


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
    def __init__(
        self, settings: Settings, storage: StorageRepo, spaces: SpaceService
    ) -> None:
        self._settings = settings
        self._storage = storage
        self._spaces = spaces

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

        # Authorize the target space BEFORE writing anything: space_id comes
        # straight from the client and must never be trusted.
        await self._require_owned_space(user, payload.space_id)

        url_str = str(payload.url) if payload.url else None
        content_hash = compute_content_hash(payload.content, url_str)
        if payload.content_hash and payload.content_hash != content_hash:
            logger.warning(
                "content_hash_mismatch",
                extra={"client_hash": payload.content_hash, "server_hash": content_hash},
            )

        # Re-capturing the same page into the same space reuses the original id,
        # so the row and its storage prefix keep pointing at each other.
        source_id = await self._existing_source_id(payload.space_id, content_hash) or uuid4()
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

        # Storage first, then the row: a failed upload must not leave a record
        # pointing at artifacts that aren't there.
        row = await self._record_source(
            user=user,
            source_id=source_id,
            space_id=payload.space_id,
            source_type=payload.type,
            title=payload.title,
            url=url_str,
            author=payload.author,
            prefix=prefix,
            content_hash=content_hash,
            captured_at=captured_at,
        )

        logger.info(
            "source_captured",
            extra={
                "source_id": row["id"],
                "space_id": str(payload.space_id),
                "type": payload.type.value,
            },
        )
        return CaptureResponse(
            source_id=UUID(row["id"]), processing_status=ProcessingStatus.queued
        )

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
        await self._require_owned_space(user, payload.space_id)

        url_str = str(payload.url) if payload.url else None
        content_hash = payload.content_hash or compute_content_hash(None, url_str)
        source_id = await self._existing_source_id(payload.space_id, content_hash) or uuid4()
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

        # The row lands now, before the client PUTs the bytes — unlike the text
        # flow, the upload happens outside this request, so `queued` is the only
        # honest status and the row is what lets us notice a PUT that never came.
        row = await self._record_source(
            user=user,
            source_id=source_id,
            space_id=payload.space_id,
            source_type=SourceType.pdf,
            title=payload.title,
            url=url_str,
            author=payload.author,
            prefix=prefix,
            content_hash=content_hash,
            captured_at=captured_at,
        )

        return UploadUrlResponse(
            source_id=UUID(row["id"]),
            processing_status=ProcessingStatus.queued,
            upload_url=upload_url,
            token=signed["token"],
            path=object_path,
        )

    async def artifact_url(
        self, *, user: User, source_id: UUID, key: str
    ) -> ArtifactUrlResponse:
        """Short-lived signed GET URL for one artifact of an owned source.

        The bucket is private, so this is the only way the web app reads a
        captured artifact. The path is always resolved against the row's own
        ``storage_prefix`` — a client-supplied path is never used directly.
        """
        source = await anyio.to_thread.run_sync(
            partial(self._spaces.require_owned_source, user, source_id)
        )
        path = f"{source['storage_prefix']}/{_validated_artifact_key(key)}"
        url = await self._storage.create_signed_url(path, ARTIFACT_URL_TTL_SECONDS)
        return ArtifactUrlResponse(url=url, expires_in=ARTIFACT_URL_TTL_SECONDS)

    # --- space/table access (sync SDK, offloaded to keep the path async) ---

    async def _require_owned_space(self, user: User, space_id: UUID) -> dict:
        return await anyio.to_thread.run_sync(
            partial(self._spaces.require_owned_space, user, space_id)
        )

    async def _existing_source_id(self, space_id: UUID, content_hash: str) -> UUID | None:
        return await anyio.to_thread.run_sync(
            partial(
                self._spaces.existing_source_id,
                space_id=space_id,
                content_hash=content_hash,
            )
        )

    async def _record_source(
        self,
        *,
        user: User,
        source_id: UUID,
        space_id: UUID,
        source_type: SourceType,
        title: str,
        url: str | None,
        author: str | None,
        prefix: str,
        content_hash: str,
        captured_at: str,
    ) -> dict:
        return await anyio.to_thread.run_sync(
            partial(
                self._spaces.record_source,
                user=user,
                source_id=source_id,
                space_id=space_id,
                source_type=source_type.value,
                title=title,
                url=url,
                author=author,
                storage_prefix=prefix,
                content_hash=content_hash,
                processing_status=ProcessingStatus.queued.value,
                captured_at=captured_at,
            )
        )

    def _absolute_upload_url(self, signed_url: str) -> str:
        base = self._settings.supabase_url.rstrip("/")
        if signed_url.startswith("http"):
            return signed_url
        if signed_url.startswith("/storage/v1"):
            return f"{base}{signed_url}"
        return f"{base}/storage/v1{signed_url if signed_url.startswith('/') else '/' + signed_url}"
