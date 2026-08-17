"""Test fixtures: hermetic app with storage + Postgres mocked (no real Supabase)."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from uuid import uuid4

# Provide required settings BEFORE the app/settings are imported so the
# lru_cached Settings() construction succeeds without a real .env.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-anthropic-key")
os.environ.setdefault("ANTHROPIC_MODEL_NAME", "claude-haiku-4-5")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.dependencies import (  # noqa: E402
    get_authenticated_app_user,
    get_capture_service,
    get_session_service,
    get_space_service,
)
from app.main import create_app  # noqa: E402
from app.repositories.storage_repo import get_storage_repo  # noqa: E402
from app.schemas.common import User  # noqa: E402
from app.services.capture_service import CaptureService  # noqa: E402
from app.services.session_service import SessionService  # noqa: E402
from app.services.space_service import SpaceService  # noqa: E402

# The space seeded for the dev user, so capture tests have somewhere to write.
SEEDED_SPACE_ID = "00000000-0000-0000-0000-0000000000b1"
SEEDED_SPACE_NAME = "System Design"
# Exists in the fake DB but belongs to somebody else — used to assert that
# ownership, not mere existence, is what authorizes a space.
OTHER_USER_SPACE_ID = "00000000-0000-0000-0000-0000000000f9"


class FakeStorage:
    """Records what would have been written to Supabase Storage."""

    def __init__(self) -> None:
        self.uploads: dict[str, tuple[bytes, str]] = {}
        self.signed_urls: list[str] = []
        self.read_urls: list[tuple[str, int]] = []

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

    async def create_signed_url(self, path: str, expires_in: int) -> str:
        self.read_urls.append((path, expires_in))
        return f"https://test.supabase.co/storage/v1/object/sign/atlas-artifacts/{path}?token=fakeread"


class FakeSpaceRepo:
    """In-memory stand-in for the ``spaces``/``sources`` tables.

    Mirrors SpaceRepo's contract, including the two unique indexes the service
    layer relies on: ``(user_id, lower(name))`` on spaces and
    ``(space_id, content_hash)`` on sources.
    """

    def __init__(self, dev_user_id: str) -> None:
        self.spaces: dict[str, dict] = {}
        self.sources: dict[str, dict] = {}
        self.active: dict[str, str | None] = {}

        self.spaces[SEEDED_SPACE_ID] = {
            "id": SEEDED_SPACE_ID,
            "user_id": dev_user_id,
            "name": SEEDED_SPACE_NAME,
            "slug": "system-design",
            "goal_text": None,
            "archived_at": None,
            "created_at": "2026-07-01T00:00:00+00:00",
        }
        self.spaces[OTHER_USER_SPACE_ID] = {
            "id": OTHER_USER_SPACE_ID,
            "user_id": "00000000-0000-0000-0000-0000000000ff",
            "name": "Someone Else's Space",
            "slug": "someone-elses-space",
            "goal_text": None,
            "archived_at": None,
            "created_at": "2026-07-01T00:00:00+00:00",
        }
        self.active[dev_user_id] = SEEDED_SPACE_ID

    # --- spaces ---

    def create_space(self, *, user_id: str, name: str, slug: str, goal_text: str | None) -> dict:
        for row in self.spaces.values():
            if row["user_id"] == user_id and row["name"].lower() == name.lower():
                raise RuntimeError('duplicate key value violates unique constraint (23505)')
        row = {
            "id": str(uuid4()),
            "user_id": user_id,
            "name": name,
            "slug": slug,
            "goal_text": goal_text,
            "archived_at": None,
            "created_at": datetime.now(UTC).isoformat(),
        }
        self.spaces[row["id"]] = row
        return row

    def list_spaces(self, user_id: str) -> list[dict]:
        out = []
        for row in self.spaces.values():
            if row["user_id"] != user_id or row["archived_at"]:
                continue
            mine = [s for s in self.sources.values() if s["space_id"] == row["id"]]
            captured = [s["captured_at"] for s in mine]
            out.append(
                {
                    **row,
                    "last_captured_at": max(captured) if captured else None,
                    "source_counts": {
                        kind: sum(1 for s in mine if s["type"] == kind)
                        for kind in ("youtube", "article", "ai_chat", "pdf", "note")
                    }
                    | {"total": len(mine)},
                }
            )
        return out

    def get_space(self, *, user_id: str, space_id: str) -> dict | None:
        row = self.spaces.get(space_id)
        return row if row and row["user_id"] == user_id else None

    def slug_exists(self, *, user_id: str, slug: str) -> bool:
        return any(
            r["user_id"] == user_id and r["slug"] == slug for r in self.spaces.values()
        )

    def count_spaces(self, user_id: str) -> int:
        return sum(1 for r in self.spaces.values() if r["user_id"] == user_id)

    # --- active space ---

    def get_active_space_id(self, user_id: str) -> str | None:
        return self.active.get(user_id)

    def set_active_space(self, *, user_id: str, space_id: str | None) -> None:
        self.active[user_id] = space_id

    # --- sources ---

    def upsert_source(self, row: dict) -> dict:
        existing = self.get_source_by_hash(
            space_id=row["space_id"], content_hash=row["content_hash"]
        )
        if existing:
            self.sources.pop(existing["id"], None)
        self.sources[row["id"]] = dict(row)
        return self.sources[row["id"]]

    def get_source_by_hash(self, *, space_id: str, content_hash: str) -> dict | None:
        for row in self.sources.values():
            if row["space_id"] == space_id and row["content_hash"] == content_hash:
                return row
        return None

    def list_sources(
        self, *, user_id: str, space_id: str | None = None, limit: int = 20
    ) -> list[dict]:
        rows = [
            {**r, "spaces": {"name": self.spaces[r["space_id"]]["name"]}}
            for r in self.sources.values()
            if r["user_id"] == user_id and (space_id is None or r["space_id"] == space_id)
        ]
        rows.sort(key=lambda r: r["captured_at"], reverse=True)
        return rows[:limit]

    def get_source(self, *, user_id: str, source_id: str) -> dict | None:
        row = self.sources.get(source_id)
        return row if row and row["user_id"] == user_id else None


@pytest.fixture
def storage() -> FakeStorage:
    return FakeStorage()


@pytest.fixture
def space_repo() -> FakeSpaceRepo:
    from app.config import get_settings

    return FakeSpaceRepo(str(get_settings().dev_user_id))


@pytest.fixture
def client(storage: FakeStorage, space_repo: FakeSpaceRepo) -> TestClient:
    from app.config import get_settings

    app = create_app()

    settings = get_settings()
    space_svc = SpaceService(space_repo)  # type: ignore[arg-type]
    session_svc = SessionService(space_repo, space_svc)  # type: ignore[arg-type]
    capture_svc = CaptureService(settings, storage, space_svc)  # type: ignore[arg-type]

    # Real routes now require a verified Supabase JWT; inject the fixed dev
    # user so tests stay hermetic (no live token verification).
    dev_user = User(id=settings.dev_user_id, email=settings.dev_user_email)

    app.dependency_overrides[get_storage_repo] = lambda: storage
    app.dependency_overrides[get_capture_service] = lambda: capture_svc
    app.dependency_overrides[get_session_service] = lambda: session_svc
    app.dependency_overrides[get_space_service] = lambda: space_svc
    app.dependency_overrides[get_authenticated_app_user] = lambda: dev_user

    return TestClient(app)
