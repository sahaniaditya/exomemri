"""Application configuration (12-factor: env only, via pydantic-settings)."""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Annotated
from uuid import UUID

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Fixed identity used by the hermetic test suite in place of a live JWT.
_DEV_USER_ID = UUID("00000000-0000-0000-0000-0000000000a1")


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

    # --- Test/dev identity (the active space now lives in Postgres) ---
    dev_user_id: UUID = _DEV_USER_ID
    dev_user_email: str = "aditya@kimaru.ai"

    # --- CORS ---
    # The unpacked extension origin (chrome-extension://<id>). Populate for a
    # stable dev id (pin a manifest `key`). Comma-separated in env.
    cors_extension_origins: Annotated[list[str], NoDecode] = []
    # Whether to allow any chrome-extension:// origin (dev convenience only).
    cors_allow_any_extension: bool = True
    # Web app origins allowed to call the API (e.g. the Vercel frontend).
    # Comma-separated in env. Scheme + host only, NO trailing slash or path.
    cors_web_origins: Annotated[list[str], NoDecode] = []

    env: str = "dev"

    @field_validator("cors_extension_origins", "cors_web_origins", mode="before")
    @classmethod
    def _split_csv(cls, v: object) -> object:
        """Accept a comma-separated string (or JSON list) from the environment."""
        if isinstance(v, str):
            s = v.strip()
            if not s:
                return []
            if s.startswith("["):
                return json.loads(s)
            return [item.strip() for item in s.split(",") if item.strip()]
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
