"""Fail-closed CORS: Settings defaults, production boot checks, origin reflection."""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.main import _configure_cors

PINNED_EXTENSION = "chrome-extension://abcdefghijklmnopabcdefghijklmnopab"
OTHER_EXTENSION = "chrome-extension://evilxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
PINNED_WEB = "https://exomemri.com"
EVIL_WEB = "https://evil.example"


def _settings(**overrides: object) -> Settings:
    kwargs: dict[str, object] = {
        "supabase_url": "https://test.supabase.co",
        "supabase_service_key": "test-service-key",
        "anthropic_api_key": "test-anthropic-key",
        "hf_token": "test-hf-token",
        "env": "dev",
        "_env_file": None,
    }
    kwargs.update(overrides)
    return Settings(**kwargs)  # type: ignore[arg-type]


def _cors_client(settings: Settings) -> TestClient:
    app = FastAPI()

    @app.get("/ping")
    def ping() -> dict[str, str]:
        return {"ok": "yes"}

    _configure_cors(app, settings)
    return TestClient(app)


def _allow_origin(client: TestClient, origin: str) -> str | None:
    return client.get("/ping", headers={"Origin": origin}).headers.get(
        "access-control-allow-origin"
    )


@pytest.fixture(autouse=True)
def _isolate_cors_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in (
        "CORS_ALLOW_ANY_EXTENSION",
        "CORS_WEB_ORIGINS",
        "CORS_EXTENSION_ORIGINS",
        "ENV",
    ):
        monkeypatch.delenv(key, raising=False)


def test_cors_allow_any_extension_defaults_false() -> None:
    assert _settings().cors_allow_any_extension is False


def test_production_rejects_any_extension_flag() -> None:
    with pytest.raises(ValidationError, match="CORS_ALLOW_ANY_EXTENSION must be false"):
        _settings(
            env="production",
            cors_allow_any_extension=True,
            cors_web_origins=[PINNED_WEB],
        )


def test_production_rejects_empty_web_origins() -> None:
    with pytest.raises(ValidationError, match="CORS_WEB_ORIGINS must be set"):
        _settings(env="production", cors_allow_any_extension=False, cors_web_origins=[])


def test_production_accepts_pinned_web_origins() -> None:
    settings = _settings(
        env="production",
        cors_allow_any_extension=False,
        cors_web_origins=[PINNED_WEB],
    )
    assert settings.cors_web_origins == [PINNED_WEB]
    assert settings.cors_allow_any_extension is False


def test_non_production_allows_any_extension_flag() -> None:
    settings = _settings(cors_allow_any_extension=True)
    assert settings.cors_allow_any_extension is True


def test_pinned_extension_origin_is_reflected_unknown_is_not() -> None:
    client = _cors_client(
        _settings(
            cors_allow_any_extension=False,
            cors_extension_origins=[PINNED_EXTENSION],
        )
    )
    assert _allow_origin(client, PINNED_EXTENSION) == PINNED_EXTENSION
    assert _allow_origin(client, OTHER_EXTENSION) is None


def test_any_extension_flag_reflects_arbitrary_chrome_extension_origin() -> None:
    client = _cors_client(_settings(cors_allow_any_extension=True))
    assert _allow_origin(client, OTHER_EXTENSION) == OTHER_EXTENSION


def test_pinned_web_origin_is_reflected_unknown_is_not() -> None:
    client = _cors_client(
        _settings(cors_allow_any_extension=False, cors_web_origins=[PINNED_WEB])
    )
    assert _allow_origin(client, PINNED_WEB) == PINNED_WEB
    assert _allow_origin(client, EVIL_WEB) is None
