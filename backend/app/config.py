"""Application configuration (12-factor: env only, via pydantic-settings)."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Annotated, Self
from uuid import UUID

import certifi
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Some local Python installs (notably python.org's macOS build) ship without
# a usable system CA bundle, so outbound HTTPS (Anthropic, Hugging Face,
# Supabase) fails with SSLCertVerificationError until this is set. setdefault
# so an operator-provided SSL_CERT_FILE (e.g. a corporate CA) is never overridden.
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

    # Hugging Face Inference API (chunk/query embeddings for RAG chat).
    hf_token: str
    hf_embedding_model: str = "BAAI/bge-small-en-v1.5"
    # Fixed to match source_chunks.embedding VECTOR(384); changing this
    # requires a matching Supabase migration.
    hf_embedding_dimension: int = 384


    # --- Test/dev identity (the active space now lives in Postgres) ---
    dev_user_id: UUID = _DEV_USER_ID
    dev_user_email: str = "aditya@exomemri.com"

    # --- CORS ---
    # Pin known extension IDs (`chrome-extension://<id>`). For a stable unpacked
    # id, pin a manifest `key`. Comma-separated in env. Production should list
    # the Chrome Web Store ID when known.
    cors_extension_origins: Annotated[list[str], NoDecode] = []
    # Whether to allow any chrome-extension:// origin (dev convenience only).
    cors_allow_any_extension: bool = True
    # Web app origins allowed to call the API (e.g. the Vercel frontend).
    # Comma-separated in env. Scheme + host only, NO trailing slash or path.
    # Required when ENV=production.
    cors_web_origins: Annotated[list[str], NoDecode] = []

    env: str = "dev"

    # --- App-level rate limits (in-process; single-instance deploy) ---
    # Login: per IP and per email (both must pass).
    rate_limit_login_max: int = 5
    rate_limit_login_window_seconds: int = 900  # 15 minutes
    # Capture + upload-url: per authenticated user.
    rate_limit_capture_max: int = 10
    rate_limit_capture_window_seconds: int = 60
    # Chat asks: per authenticated user.
    rate_limit_chat_max: int = 20
    rate_limit_chat_window_seconds: int = 60
    # Coverage LLM regen (not cache hits): per space.
    rate_limit_coverage_max: int = 1
    rate_limit_coverage_window_seconds: int = 3600  # 1 hour
    # Graph rebuild batches: per space.
    rate_limit_rebuild_max: int = 2
    rate_limit_rebuild_window_seconds: int = 3600  # 1 hour

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

    @model_validator(mode="after")
    def _reject_insecure_production_cors(self) -> Self:
        if self.env.strip().lower() != "production":
            return self
        if self.cors_allow_any_extension:
            raise ValueError(
                "CORS_ALLOW_ANY_EXTENSION must be false when ENV=production"
            )
        if not self.cors_web_origins:
            raise ValueError("CORS_WEB_ORIGINS must be set when ENV=production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
