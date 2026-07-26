"""Test fixtures: hermetic app with storage mocked (no real Supabase calls)."""

from __future__ import annotations

import os

# Provide required settings BEFORE the app/settings are imported so the
# lru_cached Settings() construction succeeds without a real .env.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.dependencies import (  # noqa: E402
    get_authenticated_app_user,
    get_capture_service,
    get_session_service,
)
from app.main import create_app  # noqa: E402
from app.repositories.storage_repo import get_storage_repo  # noqa: E402
from app.schemas.common import User  # noqa: E402
from app.services.capture_service import CaptureService  # noqa: E402
from app.services.session_service import SessionService  # noqa: E402


class FakeStorage:
    """Records what would have been written to Supabase Storage."""

    def __init__(self) -> None:
        self.uploads: dict[str, tuple[bytes, str]] = {}
        self.signed_urls: list[str] = []

    async def upload(self, path: str, data: bytes, content_type: str) -> None:
        self.uploads[path] = (data, content_type)

    async def upload_text(self, path: str, text: str, content_type: str) -> None:
        self.uploads[path] = (text.encode("utf-8"), content_type)

    async def create_signed_upload_url(self, path: str) -> dict:
        self.signed_urls.append(path)
        return {
            "signed_url": f"/object/upload/sign/atlas-artifacts/{path}?token=faketoken",
            "token": "faketoken",
            "path": path,
        }


@pytest.fixture
def storage() -> FakeStorage:
    return FakeStorage()


@pytest.fixture
def client(storage: FakeStorage) -> TestClient:
    from app.config import get_settings

    app = create_app()

    # One SessionService per test (state persists across requests within a
    # test, but a fresh app per test keeps tests isolated from each other).
    session_svc = SessionService(get_settings())
    capture_svc = CaptureService(get_settings(), storage)  # type: ignore[arg-type]

    # Real routes now require a verified Supabase JWT; inject the fixed dev
    # user so tests stay hermetic (no live token verification).
    settings = get_settings()
    dev_user = User(id=settings.dev_user_id, email=settings.dev_user_email)

    app.dependency_overrides[get_storage_repo] = lambda: storage
    app.dependency_overrides[get_capture_service] = lambda: capture_svc
    app.dependency_overrides[get_session_service] = lambda: session_svc
    app.dependency_overrides[get_authenticated_app_user] = lambda: dev_user

    return TestClient(app)
