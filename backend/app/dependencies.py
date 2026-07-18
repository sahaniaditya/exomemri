"""FastAPI dependency providers (DI seams for testing and Phase 2 auth swap)."""

from __future__ import annotations

from functools import lru_cache

from fastapi import Depends

from app.config import Settings, get_settings
from app.repositories.storage_repo import StorageRepo, get_storage_repo
from app.schemas.common import User
from app.services.capture_service import CaptureService
from app.services.session_service import SessionService


@lru_cache
def get_session_service() -> SessionService:
    return SessionService(get_settings())


def get_capture_service(
    settings: Settings = Depends(get_settings),
    storage: StorageRepo = Depends(get_storage_repo),
) -> CaptureService:
    return CaptureService(settings, storage)


def get_current_user(settings: Settings = Depends(get_settings)) -> User:
    """Phase 0 dev-stub: always the fixed dev user.

    Structured as a dependency so Phase 2 can swap in real cookie/Supabase
    auth without touching routers or services.
    """
    return User(id=settings.dev_user_id, email=settings.dev_user_email)
