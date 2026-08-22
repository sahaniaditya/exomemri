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
os.environ.setdefault("VOYAGE_API_KEY", "test-voyage-key")

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
from app.schemas.concepts import ExtractedConcept  # noqa: E402
from app.services.capture_service import CaptureService  # noqa: E402
from app.services.concept_service import ConceptService  # noqa: E402
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

    async def download_text(self, path: str) -> str:
        from app.errors import StorageError

        if path not in self.uploads:
            raise StorageError("Failed to read artifact from storage")
        data, _content_type = self.uploads[path]
        return data.decode("utf-8")


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
        self.messages: dict[str, dict] = {}

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

    def update_processing_status(self, *, source_id: str, status: str) -> None:
        if source_id in self.sources:
            self.sources[source_id]["processing_status"] = status

    def update_source_summary(
        self, *, source_id: str, summary_text: str, summary_model: str, summarized_at: str
    ) -> None:
        if source_id in self.sources:
            self.sources[source_id].update(
                summary_text=summary_text,
                summary_model=summary_model,
                summarized_at=summarized_at,
            )

    def list_unextracted_sources(self, *, space_id: str, limit: int) -> list[dict]:
        rows = [
            r
            for r in self.sources.values()
            if r["space_id"] == space_id and not r.get("concepts_extracted_at")
        ]
        rows.sort(key=lambda r: r["captured_at"])
        return rows[:limit]

    def mark_concepts_extracted(
        self, *, source_id: str, model: str, extracted_at: str
    ) -> None:
        if source_id in self.sources:
            self.sources[source_id].update(
                concepts_model=model, concepts_extracted_at=extracted_at
            )

    def list_source_messages(self, *, source_id: str) -> list[dict]:
        rows = [m for m in self.messages.values() if m["source_id"] == source_id]
        rows.sort(key=lambda m: m["created_at"])
        return rows

    def insert_source_message(
        self, *, source_id: str, space_id: str, user_id: str, role: str, content: str
    ) -> dict:
        row = {
            "id": str(uuid4()),
            "source_id": source_id,
            "space_id": space_id,
            "user_id": user_id,
            "role": role,
            "content": content,
            "created_at": datetime.now(UTC).isoformat(),
        }
        self.messages[row["id"]] = row
        return row


class FakeChunkRepo:
    """In-memory stand-in for the pgvector-backed ``source_chunks`` table."""

    def __init__(self) -> None:
        self.chunks_by_source: dict[str, list[dict]] = {}

    def replace_chunks(self, *, source_id: str, chunks: list[dict]) -> None:
        self.chunks_by_source[source_id] = list(chunks)

    def search(
        self, *, source_id: str, user_id: str, query_embedding: list[float], k: int = 6
    ) -> list[dict]:
        def cosine(a: list[float], b: list[float]) -> float:
            dot = sum(x * y for x, y in zip(a, b, strict=True))
            norm_a = sum(x * x for x in a) ** 0.5
            norm_b = sum(x * x for x in b) ** 0.5
            return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0

        rows = self.chunks_by_source.get(source_id, [])
        ranked = sorted(rows, key=lambda r: cosine(r["embedding"], query_embedding), reverse=True)
        return [
            {
                "id": r.get("id", str(uuid4())),
                "content": r["content"],
                "chunk_index": r["chunk_index"],
                "similarity": cosine(r["embedding"], query_embedding),
            }
            for r in ranked[:k]
        ]


class FakeConceptRepo:
    """In-memory stand-in for ``concepts``/``source_concepts``.

    Enforces the ``(space_id, slug)`` unique index the canonicalization relies on
    — without it the tests would pass while the real database rejected the
    upsert.
    """

    def __init__(self) -> None:
        self.concepts: dict[str, dict] = {}
        self.edges: list[dict] = []

    def list_labels(self, *, space_id: str) -> list[str]:
        return [c["label"] for c in self.concepts.values() if c["space_id"] == space_id]

    def upsert_concepts(self, rows: list[dict]) -> list[dict]:
        out = []
        for row in rows:
            existing = next(
                (
                    c
                    for c in self.concepts.values()
                    if c["space_id"] == row["space_id"] and c["slug"] == row["slug"]
                ),
                None,
            )
            if existing:
                out.append(existing)
                continue
            created = {"id": str(uuid4()), **row}
            self.concepts[created["id"]] = created
            out.append(created)
        return out

    def replace_source_concepts(self, *, source_id: str, edges: list[dict]) -> None:
        self.edges = [e for e in self.edges if e["source_id"] != source_id]
        self.edges.extend(edges)

    def delete_orphan_concepts(self, *, space_id: str) -> None:
        referenced = {e["concept_id"] for e in self.edges}
        for cid in [
            c["id"]
            for c in self.concepts.values()
            if c["space_id"] == space_id and c["id"] not in referenced
        ]:
            self.concepts.pop(cid, None)

    def get_space_graph(self, *, user_id: str, space_id: str) -> dict:  # noqa: ARG002
        edges = [e for e in self.edges if e["space_id"] == space_id]
        degree: dict[str, int] = {}
        for e in edges:
            degree[e["concept_id"]] = degree.get(e["concept_id"], 0) + 1
        concepts = [
            {
                "id": c["id"],
                "label": c["label"],
                "slug": c["slug"],
                "degree": degree.get(c["id"], 0),
            }
            for c in self.concepts.values()
            if c["space_id"] == space_id
        ]
        concepts.sort(key=lambda c: (-c["degree"], c["label"]))
        return {
            "concepts": concepts,
            "sources": [
                {
                    "id": s["id"],
                    "title": s["title"],
                    "type": s["type"],
                    "captured_at": s["captured_at"],
                }
                for s in self._sources_in(space_id)
            ],
            "edges": [
                {
                    "source_id": e["source_id"],
                    "concept_id": e["concept_id"],
                    "weight": e["weight"],
                }
                for e in edges
            ],
            "pending": sum(
                1 for s in self._sources_in(space_id) if not s.get("concepts_extracted_at")
            ),
        }

    # Wired by the `concept_repo` fixture so the graph read can see sources.
    _space_repo: FakeSpaceRepo | None = None

    def _sources_in(self, space_id: str) -> list[dict]:
        if self._space_repo is None:
            return []
        return [s for s in self._space_repo.sources.values() if s["space_id"] == space_id]


class FakeEmbeddingService:
    """Deterministic vectors (no network) — same text always embeds the same."""

    model_name = "fake-embed"

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._vector(t) for t in texts]

    async def embed_query(self, text: str) -> list[float]:
        return self._vector(text)

    @staticmethod
    def _vector(text: str) -> list[float]:
        seed = sum(ord(c) for c in text) or 1
        return [((seed >> i) % 11) / 11 for i in range(8)]


class FakeLLMService:
    """Canned summarize/chat replies — no Anthropic call."""

    model_name = "fake-llm"

    async def summarize(self, *, title: str, extract: str) -> str:  # noqa: ARG002
        return f"Summary of {title}"

    async def chat_reply(
        self, *, title: str, source_type: str, summary: str, extract: str, history: list[dict]
    ) -> str:  # noqa: ARG002
        return f"Reply grounded in: {extract[:200]}"

    async def extract_concepts(
        self, *, title: str, extract: str, vocabulary: list[str]  # noqa: ARG002
    ) -> list[ExtractedConcept]:
        """Two concepts derived from the title, plus one already in the space.

        Echoing back a vocabulary label is what lets a test assert that a second
        source on the same subject merges onto one node instead of forking.
        """
        labels = [f"{title} basics", "Shared subject"]
        return [
            ExtractedConcept(label=label, weight=1.0 - (i * 0.3))
            for i, label in enumerate(labels)
        ]


class FakePipelineService:
    """Records invocations instead of running the real chunk/embed/summarize graph."""

    def __init__(self) -> None:
        self.runs: list[dict] = []

    async def run(self, *, user: User, source_id, space_id) -> None:
        self.runs.append(
            {"user_id": str(user.id), "source_id": str(source_id), "space_id": str(space_id)}
        )


@pytest.fixture
def storage() -> FakeStorage:
    return FakeStorage()


@pytest.fixture
def space_repo() -> FakeSpaceRepo:
    from app.config import get_settings

    return FakeSpaceRepo(str(get_settings().dev_user_id))


@pytest.fixture
def chunk_repo() -> FakeChunkRepo:
    return FakeChunkRepo()


@pytest.fixture
def concept_repo(space_repo: FakeSpaceRepo) -> FakeConceptRepo:
    repo = FakeConceptRepo()
    repo._space_repo = space_repo
    return repo


@pytest.fixture
def embedding_service() -> FakeEmbeddingService:
    return FakeEmbeddingService()


@pytest.fixture
def llm_service() -> FakeLLMService:
    return FakeLLMService()


@pytest.fixture
def pipeline_service() -> FakePipelineService:
    return FakePipelineService()


@pytest.fixture
def client(
    storage: FakeStorage,
    space_repo: FakeSpaceRepo,
    chunk_repo: FakeChunkRepo,
    concept_repo: FakeConceptRepo,
    embedding_service: FakeEmbeddingService,
    llm_service: FakeLLMService,
    pipeline_service: FakePipelineService,
) -> TestClient:
    from app.config import get_settings
    from app.dependencies import (
        get_chunk_repo,
        get_concept_service,
        get_embedding_service,
        get_llm_service,
        get_pipeline_service,
        get_source_chat_service,
    )
    from app.services.extract_service import ExtractService
    from app.services.source_chat_service import SourceChatService

    app = create_app()

    settings = get_settings()
    space_svc = SpaceService(space_repo)  # type: ignore[arg-type]
    session_svc = SessionService(space_repo, space_svc)  # type: ignore[arg-type]
    capture_svc = CaptureService(settings, storage, space_svc)  # type: ignore[arg-type]
    extract_svc = ExtractService(storage)  # type: ignore[arg-type]
    concept_svc = ConceptService(
        concept_repo, space_svc, extract_svc, llm_service  # type: ignore[arg-type]
    )
    chat_svc = SourceChatService(
        space_svc, extract_svc, llm_service, embedding_service, chunk_repo  # type: ignore[arg-type]
    )

    # Real routes now require a verified Supabase JWT; inject the fixed dev
    # user so tests stay hermetic (no live token verification).
    dev_user = User(id=settings.dev_user_id, email=settings.dev_user_email)

    app.dependency_overrides[get_storage_repo] = lambda: storage
    app.dependency_overrides[get_capture_service] = lambda: capture_svc
    app.dependency_overrides[get_session_service] = lambda: session_svc
    app.dependency_overrides[get_space_service] = lambda: space_svc
    app.dependency_overrides[get_authenticated_app_user] = lambda: dev_user
    app.dependency_overrides[get_chunk_repo] = lambda: chunk_repo
    app.dependency_overrides[get_concept_service] = lambda: concept_svc
    app.dependency_overrides[get_embedding_service] = lambda: embedding_service
    app.dependency_overrides[get_llm_service] = lambda: llm_service
    app.dependency_overrides[get_source_chat_service] = lambda: chat_svc
    # The real pipeline calls Anthropic/Voyage over the network — never run it
    # from the capture path in tests; dedicated pipeline tests exercise the
    # real graph directly against fakes instead.
    app.dependency_overrides[get_pipeline_service] = lambda: pipeline_service

    return TestClient(app)
