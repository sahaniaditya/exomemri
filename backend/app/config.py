"""Application configuration (12-factor: env only, via pydantic-settings)."""

from __future__ import annotations

from functools import lru_cache
from uuid import UUID

from pydantic_settings import BaseSettings, SettingsConfigDict

# Fixed identities for the Phase 0 dev-stub session. Replaced by real
# auth + learning_sessions in Phase 2.
_DEV_USER_ID = UUID("00000000-0000-0000-0000-0000000000a1")
_DEV_SPACE_ID = UUID("00000000-0000-0000-0000-0000000000b1")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Supabase (required) ---
    supabase_url: str
    supabase_service_key: str
    storage_bucket: str = "atlas-artifacts"

    # --- Dev-stub session (Phase 0) ---
    dev_user_id: UUID = _DEV_USER_ID
    dev_user_email: str = "aditya@kimaru.ai"
    dev_space_id: UUID = _DEV_SPACE_ID
    dev_space_name: str = "System Design"

    # --- CORS ---
    # The unpacked extension origin (chrome-extension://<id>). Populate for a
    # stable dev id (pin a manifest `key`). Comma-separated in env.
    cors_extension_origins: list[str] = []
    # Whether to allow any chrome-extension:// origin (dev convenience only).
    cors_allow_any_extension: bool = True

    env: str = "dev"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
