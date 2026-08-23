"""Supabase Storage access — the ONLY module that touches the storage SDK.

The client is initialized with the service key and lives server-side only;
credentials never reach the browser. The Supabase Python client is sync, so
calls are offloaded to a worker thread to keep the request path async.
"""

from __future__ import annotations

import logging
from functools import lru_cache

import anyio
import httpx
from supabase import Client, ClientOptions, create_client

from app.config import Settings, get_settings
from app.errors import StorageError

logger = logging.getLogger(__name__)


@lru_cache
def _client(url: str, key: str) -> Client:
    # Mirror supabase_client: PostgREST defaults to http2=True, which dies
    # under concurrent threadpool load (ConnectionTerminated).
    return create_client(
        url,
        key,
        options=ClientOptions(
            httpx_client=httpx.Client(http2=False, follow_redirects=True),
        ),
    )


class StorageRepo:
    """Thin async wrapper over a single Supabase Storage bucket."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._bucket_name = settings.storage_bucket

    @property
    def _bucket(self):  # noqa: ANN202 - supabase StorageFileAPI, untyped
        client = _client(self._settings.supabase_url, self._settings.supabase_service_key)
        return client.storage.from_(self._bucket_name)

    async def upload(self, path: str, data: bytes, content_type: str) -> None:
        """Upload (upsert) bytes to ``path`` within the bucket."""

        def _do() -> None:
            self._bucket.upload(
                path=path,
                file=data,
                file_options={"content-type": content_type, "upsert": "true"},
            )

        try:
            await anyio.to_thread.run_sync(_do)
        except Exception as exc:  # noqa: BLE001 - normalize SDK errors
            logger.error("storage_upload_failed", extra={"path": path})
            raise StorageError("Failed to write artifact to storage") from exc

    async def upload_text(self, path: str, text: str, content_type: str) -> None:
        await self.upload(path, text.encode("utf-8"), content_type)

    async def create_signed_url(self, path: str, expires_in: int) -> str:
        """Create a short-lived signed GET URL for reading a private object."""

        def _do() -> dict:
            return self._bucket.create_signed_url(path, expires_in)

        try:
            result = await anyio.to_thread.run_sync(_do)
        except Exception as exc:  # noqa: BLE001 - normalize SDK errors
            logger.error("signed_url_failed", extra={"path": path})
            raise StorageError("Failed to create signed URL") from exc

        # storage3 returns signedURL/signedUrl/signed_url depending on version.
        url = result.get("signedURL") or result.get("signedUrl") or result.get("signed_url")
        if not url:
            logger.error("signed_url_missing", extra={"path": path})
            raise StorageError("Failed to create signed URL")
        return url

    async def create_signed_upload_url(self, path: str) -> dict:
        """Create a single-use tokenized upload URL for a client-side PUT.

        Returns the SDK dict, normalized to always contain ``signed_url``,
        ``token`` and ``path`` keys.
        """

        def _do() -> dict:
            return self._bucket.create_signed_upload_url(path)

        try:
            result = await anyio.to_thread.run_sync(_do)
        except Exception as exc:  # noqa: BLE001
            logger.error("signed_upload_url_failed", extra={"path": path})
            raise StorageError("Failed to create signed upload URL") from exc

        # storage3 returns keys signed_url/signedUrl depending on version.
        signed_url = result.get("signed_url") or result.get("signedUrl") or ""
        token = result.get("token", "")
        return {"signed_url": signed_url, "token": token, "path": result.get("path", path)}

    async def download_text(self, path: str) -> str:
        """Read a text artifact directly using the service-role client."""
        
        def _download() -> bytes:
            # self._bucket already handles: client.storage.from_(self._bucket_name)
            return self._bucket.download(path)

        try:
            raw = await anyio.to_thread.run_sync(_download)
        except Exception as exc:  # noqa: BLE001 - normalize SDK errors
            logger.error("storage_download_failed", extra={"path": path})
            raise StorageError("Failed to read artifact from storage") from exc

        try:
            return raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            logger.error("storage_decode_failed", extra={"path": path})
            raise StorageError("Downloaded artifact is not valid UTF-8 text") from exc


@lru_cache
def get_storage_repo() -> StorageRepo:
    return StorageRepo(get_settings())
