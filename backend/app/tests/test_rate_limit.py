"""App-level rate limit tests (C2)."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.config import get_settings
from app.errors import RateLimitError
from app.main import create_app
from app.rate_limit import client_ip, get_rate_limiter
from app.schemas.auth import AuthUser, LoginResponse
from app.schemas.common import User
from app.services.coverage_service import CoverageService
from app.services.credits_service import CreditsService
from app.services.rate_limit_service import RateLimitService
from app.services.space_service import SpaceService
from app.tests.conftest import (
    SEEDED_SPACE_ID,
    FakeCollaboratorRepo,
    FakeConceptRepo,
    FakeCoverageRepo,
    FakeCreditsRepo,
    FakeLLMService,
    FakeSpaceRepo,
    FakeStorage,
)

# ---------------------------------------------------------------------------
# Unit: RateLimitService
# ---------------------------------------------------------------------------


def test_limiter_allows_up_to_limit_then_raises() -> None:
    limiter = RateLimitService()
    for _ in range(3):
        limiter.check("k", limit=3, window_seconds=60)
    with pytest.raises(RateLimitError) as exc_info:
        limiter.check("k", limit=3, window_seconds=60)
    assert exc_info.value.code == "rate_limited"
    assert "retry_after_seconds" in (exc_info.value.detail or {})


def test_limiter_resets_after_window(monkeypatch: pytest.MonkeyPatch) -> None:
    limiter = RateLimitService()
    clock = {"t": 1_000.0}
    monkeypatch.setattr(
        "app.services.rate_limit_service.time.monotonic", lambda: clock["t"]
    )
    limiter.check("k", limit=1, window_seconds=10)
    with pytest.raises(RateLimitError):
        limiter.check("k", limit=1, window_seconds=10)
    clock["t"] = 1_011.0
    limiter.check("k", limit=1, window_seconds=10)


def test_client_ip_prefers_forwarded_for() -> None:
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": [(b"x-forwarded-for", b"203.0.113.9, 10.0.0.1")],
        "client": ("127.0.0.1", 12345),
        "server": ("test", 80),
    }
    assert client_ip(Request(scope)) == "203.0.113.9"


# ---------------------------------------------------------------------------
# Login (unauthenticated app + mocked AuthService)
# ---------------------------------------------------------------------------


class _FakeAuthService:
    def login(self, email: str, password: str) -> LoginResponse:
        _ = password
        return LoginResponse(
            access_token="access",
            refresh_token="refresh",
            user=AuthUser(id="00000000-0000-0000-0000-0000000000a1", email=email),
        )


def _login_client(*, login_max: int = 3) -> TestClient:
    from app.dependencies import get_auth_service

    app = create_app()
    limiter = RateLimitService()
    settings = get_settings().model_copy(
        update={
            "rate_limit_login_max": login_max,
            "rate_limit_login_window_seconds": 900,
        }
    )
    app.dependency_overrides[get_auth_service] = lambda: _FakeAuthService()
    app.dependency_overrides[get_rate_limiter] = lambda: limiter
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app)


def test_login_rate_limited_after_max_attempts() -> None:
    client = _login_client(login_max=3)
    payload = {"email": "brute@example.com", "password": "x"}
    headers = {"X-Forwarded-For": "198.51.100.7"}
    for _ in range(3):
        assert client.post("/v1/auth/login", json=payload, headers=headers).status_code == 200
    blocked = client.post("/v1/auth/login", json=payload, headers=headers)
    assert blocked.status_code == 429
    body = blocked.json()
    assert body["error"]["code"] == "rate_limited"
    assert "retry_after_seconds" in body["error"]["detail"]


def test_login_ip_and_email_are_independent_buckets() -> None:
    client = _login_client(login_max=2)
    # Exhaust IP bucket for 198.51.100.1 with email A.
    for _ in range(2):
        assert (
            client.post(
                "/v1/auth/login",
                json={"email": "a@example.com", "password": "x"},
                headers={"X-Forwarded-For": "198.51.100.1"},
            ).status_code
            == 200
        )
    # Same IP, different email still blocked by IP key.
    assert (
        client.post(
            "/v1/auth/login",
            json={"email": "b@example.com", "password": "x"},
            headers={"X-Forwarded-For": "198.51.100.1"},
        ).status_code
        == 429
    )
    # Different IP can still use email B.
    assert (
        client.post(
            "/v1/auth/login",
            json={"email": "b@example.com", "password": "x"},
            headers={"X-Forwarded-For": "198.51.100.2"},
        ).status_code
        == 200
    )


# ---------------------------------------------------------------------------
# Authenticated routes (capture / chat / rebuild) via shared client overrides
# ---------------------------------------------------------------------------


def test_capture_rate_limited(client: TestClient) -> None:
    limiter = RateLimitService()
    settings = get_settings().model_copy(
        update={"rate_limit_capture_max": 2, "rate_limit_capture_window_seconds": 60}
    )
    client.app.dependency_overrides[get_rate_limiter] = lambda: limiter
    client.app.dependency_overrides[get_settings] = lambda: settings

    def _post(n: int) -> int:
        return client.post(
            "/v1/sources",
            json={
                "space_id": SEEDED_SPACE_ID,
                "type": "article",
                "url": f"https://example.com/p{n}",
                "title": f"Post {n}",
                "content": f"body {n}",
            },
        ).status_code

    assert _post(1) == 202
    assert _post(2) == 202
    blocked = client.post(
        "/v1/sources",
        json={
            "space_id": SEEDED_SPACE_ID,
            "type": "article",
            "url": "https://example.com/p3",
            "title": "Post 3",
            "content": "body 3",
        },
    )
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "rate_limited"


def test_chat_rate_limited(
    client: TestClient, space_repo: FakeSpaceRepo, storage: FakeStorage
) -> None:
    source_id = str(uuid4())
    prefix = (
        f"users/00000000-0000-0000-0000-0000000000a1/spaces/"
        f"{SEEDED_SPACE_ID}/sources/{source_id}"
    )
    space_repo.sources[source_id] = {
        "id": source_id,
        "space_id": SEEDED_SPACE_ID,
        "user_id": "00000000-0000-0000-0000-0000000000a1",
        "type": "note",
        "title": "My note",
        "url": None,
        "author": None,
        "storage_prefix": prefix,
        "content_hash": "hash",
            "processing_status": "ready",
        "captured_at": "2026-08-18T00:00:00+00:00",
        "summary_text": None,
        "summary_sections": None,
        "summary_model": None,
        "summarized_at": None,
    }
    storage.uploads[f"{prefix}/raw/note.txt"] = (b"note text", "text/plain")

    limiter = RateLimitService()
    settings = get_settings().model_copy(
        update={"rate_limit_chat_max": 2, "rate_limit_chat_window_seconds": 60}
    )
    client.app.dependency_overrides[get_rate_limiter] = lambda: limiter
    client.app.dependency_overrides[get_settings] = lambda: settings

    for _ in range(2):
        res = client.post(f"/v1/sources/{source_id}/messages", json={"content": "hi"})
        assert res.status_code == 200
    blocked = client.post(f"/v1/sources/{source_id}/messages", json={"content": "again"})
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "rate_limited"


def test_rebuild_rate_limited(client: TestClient) -> None:
    limiter = RateLimitService()
    settings = get_settings().model_copy(
        update={"rate_limit_rebuild_max": 1, "rate_limit_rebuild_window_seconds": 3600}
    )
    client.app.dependency_overrides[get_rate_limiter] = lambda: limiter
    client.app.dependency_overrides[get_settings] = lambda: settings

    first = client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/graph/rebuild")
    assert first.status_code == 200
    blocked = client.post(f"/v1/spaces/{SEEDED_SPACE_ID}/graph/rebuild")
    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "rate_limited"


# ---------------------------------------------------------------------------
# Coverage: only LLM regen consumes budget
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_coverage_regen_rate_limited_cache_hit_free(
    space_repo: FakeSpaceRepo,
    concept_repo: FakeConceptRepo,
    coverage_repo: FakeCoverageRepo,
    llm_service: FakeLLMService,
) -> None:
    settings = get_settings().model_copy(
        update={
            "rate_limit_coverage_max": 1,
            "rate_limit_coverage_window_seconds": 3600,
        }
    )
    limiter = RateLimitService()
    spaces = SpaceService(space_repo, FakeCollaboratorRepo())  # type: ignore[arg-type]
    credits = CreditsService(FakeCreditsRepo())  # type: ignore[arg-type]
    svc = CoverageService(
        coverage_repo, concept_repo, spaces, llm_service, limiter, settings, credits  # type: ignore[arg-type]
    )
    user = User(id=UUID(str(get_settings().dev_user_id)), email="dev@exomemri.com")

    for label in ("Alpha", "Beta"):
        row_id = str(uuid4())
        concept_repo.concepts[row_id] = {
            "id": row_id,
            "space_id": SEEDED_SPACE_ID,
            "user_id": str(user.id),
            "label": label,
            "slug": label.lower(),
        }

    space_id = UUID(SEEDED_SPACE_ID)
    first = await svc.regenerate(user, space_id)
    assert first.coverage_pct is not None

    # GET is cache-only — must not consume the hourly token.
    second = await svc.get_coverage(user, space_id)
    assert second.coverage_pct == first.coverage_pct

    with pytest.raises(RateLimitError):
        await svc.regenerate(user, space_id)
