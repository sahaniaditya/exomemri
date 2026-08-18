"""Application configuration (12-factor: env only, via pydantic-settings)."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Annotated
from uuid import UUID

import certifi
from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Some local Python installs (notably python.org's macOS build) ship without
# a usable system CA bundle, so outbound HTTPS (Anthropic, Voyage, Supabase)
# fails with SSLCertVerificationError until this is set. setdefault so an
# operator-provided SSL_CERT_FILE (e.g. a corporate CA) is never overridden.
os.environ.setdefault("SSL_CERT_FILE", certifi.where())

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

    anthropic_api_key: str
    anthropic_model_name: str = "claude-haiku-4-5"

    voyage_api_key: str
    # voyage-4-lite: current generation, part of Voyage's 200M-free-token tier.
    voyage_model_name: str = "voyage-4-lite"
    # Fixed regardless of model default, so the pgvector column width never
    # has to change alongside a model swap.
    voyage_embedding_dimension: int = 1024


    # --- Test/dev identity (the active space now lives in Postgres) ---
    dev_user_id: UUID = _DEV_USER_ID
    dev_user_email: str = "aditya@atlas.ai"

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
