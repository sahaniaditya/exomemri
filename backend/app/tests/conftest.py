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
os.environ.setdefault("HF_TOKEN", "test-hf-token")

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
from app.schemas.coverage import SyllabusTopic  # noqa: E402
from app.schemas.sources import StructuredSummary  # noqa: E402
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

    async def delete_prefix(self, prefix: str) -> None:
        from app.errors import StorageError

        clean = prefix.strip().strip("/")
        if not clean or ".." in clean or "/sources/" not in f"/{clean}/":
            raise StorageError("Refusing to delete an invalid storage prefix")
        rooted = f"{clean}/"
        for path in [p for p in self.uploads if p == clean or p.startswith(rooted)]:
            del self.uploads[path]


class FakeNoteRepo:
    """In-memory ``source_notes`` table, keyed by note id."""

    def __init__(self) -> None:
        self.notes: dict[str, dict] = {}

    def list_by_source(self, *, source_id: str, user_id: str) -> list[dict]:
        rows = [
            row
            for row in self.notes.values()
            if row["source_id"] == source_id and row["user_id"] == user_id
        ]
        return sorted(
            rows, key=lambda row: (row["sort_order"], row.get("created_at") or "")
        )

    def get(self, *, source_id: str, note_id: str, user_id: str) -> dict | None:
        row = self.notes.get(note_id)
        if not row or row["source_id"] != source_id or row["user_id"] != user_id:
            return None
        return row

    def insert(
        self,
        *,
        note_id: str,
        source_id: str,
        user_id: str,
        space_id: str,
        title: str,
        content: dict,
        sort_order: int,
    ) -> dict:
        now = datetime.now(UTC).isoformat()
        row = {
            "id": note_id,
            "source_id": source_id,
            "user_id": user_id,
            "space_id": space_id,
            "title": title,
            "content": content,
            "sort_order": sort_order,
            "created_at": now,
            "updated_at": now,
        }
        self.notes[note_id] = row
        return row

    def update(
        self,
        *,
        source_id: str,
        note_id: str,
        user_id: str,
        title: str | None = None,
        content: dict | None = None,
    ) -> dict | None:
        row = self.get(source_id=source_id, note_id=note_id, user_id=user_id)
        if not row:
            return None
        if title is not None:
            row["title"] = title
        if content is not None:
            row["content"] = content
        row["updated_at"] = datetime.now(UTC).isoformat()
        return row

    def delete(self, *, source_id: str, note_id: str, user_id: str) -> bool:
        row = self.get(source_id=source_id, note_id=note_id, user_id=user_id)
        if not row:
            return False
        del self.notes[note_id]
        return True


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
        self.folders: dict[str, dict] = {}
        # Wired by the `coverage_repo` fixture so list_spaces can surface the
        # cached percentage, mirroring the real RPC's LEFT JOIN.
        self._coverage_repo: FakeCoverageRepo | None = None

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
                    "coverage_pct": (
                        self._coverage_repo.coverage.get(row["id"], {}).get("coverage_pct")
                        if self._coverage_repo
                        else None
                    ),
                }
            )
        return out

    def get_space(self, *, user_id: str, space_id: str) -> dict | None:
        row = self.spaces.get(space_id)
        return row if row and row["user_id"] == user_id else None

    def get_space_any(self, *, space_id: str) -> dict | None:
        return self.spaces.get(space_id)

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

    def list_sources_for_space(self, *, space_id: str, limit: int = 20) -> list[dict]:
        rows = [
            {**r, "spaces": {"name": self.spaces[r["space_id"]]["name"]}}
            for r in self.sources.values()
            if r["space_id"] == space_id
        ]
        rows.sort(key=lambda r: r["captured_at"], reverse=True)
        return rows[:limit]

    def get_source(self, *, user_id: str, source_id: str) -> dict | None:
        row = self.sources.get(source_id)
        return row if row and row["user_id"] == user_id else None

    def get_source_any(self, *, source_id: str) -> dict | None:
        return self.sources.get(source_id)

    def delete_source(self, *, source_id: str) -> None:
        self.sources.pop(source_id, None)
        self.messages = {k: v for k, v in self.messages.items() if v["source_id"] != source_id}

    def update_processing_status(self, *, source_id: str, status: str) -> None:
        if source_id in self.sources:
            self.sources[source_id]["processing_status"] = status

    def update_source_summary(
        self,
        *,
        source_id: str,
        summary_text: str,
        summary_sections: dict,
        summary_model: str,
        summarized_at: str,
    ) -> None:
        if source_id in self.sources:
            self.sources[source_id].update(
                summary_text=summary_text,
                summary_sections=summary_sections,
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


    # --- folders ---

    def create_folder(self, *, space_id: str, user_id: str, name: str) -> dict:
        for row in self.folders.values():
            if row["space_id"] == space_id and row["name"].lower() == name.lower():
                raise RuntimeError("duplicate key value violates unique constraint (23505)")
        row = {
            "id": str(uuid4()),
            "space_id": space_id,
            "user_id": user_id,
            "name": name,
            "created_at": datetime.now(UTC).isoformat(),
        }
        self.folders[row["id"]] = row
        return dict(row)

    def list_folders(self, *, space_id: str) -> list[dict]:
        out = []
        for row in self.folders.values():
            if row["space_id"] != space_id:
                continue
            count = sum(1 for s in self.sources.values() if s.get("folder_id") == row["id"])
            out.append({**row, "source_count": count})
        out.sort(key=lambda r: r["name"].lower())
        return out

    def get_folder(self, *, space_id: str, folder_id: str) -> dict | None:
        row = self.folders.get(folder_id)
        if not row or row["space_id"] != space_id:
            return None
        count = sum(1 for s in self.sources.values() if s.get("folder_id") == folder_id)
        return {**row, "source_count": count}

    def rename_folder(self, *, folder_id: str, name: str) -> dict:
        row = self.folders[folder_id]
        for other in self.folders.values():
            if (
                other["id"] != folder_id
                and other["space_id"] == row["space_id"]
                and other["name"].lower() == name.lower()
            ):
                raise RuntimeError("duplicate key value violates unique constraint (23505)")
        row["name"] = name
        return dict(row)

    def delete_folder(self, *, folder_id: str) -> None:
        self.folders.pop(folder_id, None)
        for source in self.sources.values():
            if source.get("folder_id") == folder_id:
                source["folder_id"] = None

    def set_source_folder(self, *, source_id: str, folder_id: str | None) -> dict:
        self.sources[source_id]["folder_id"] = folder_id
        return dict(self.sources[source_id])


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


class FakeCoverageRepo:
    """In-memory stand-in for ``space_coverage``."""

    def __init__(self) -> None:
        self.coverage: dict[str, dict] = {}

    def get(self, *, space_id: str) -> dict | None:
        return self.coverage.get(space_id)

    def upsert(
        self,
        *,
        space_id: str,
        user_id: str,
        coverage_pct: int | None,
        topics: list[dict],
        concept_count: int,
        generated_at: str | None,
    ) -> None:
        self.coverage[space_id] = {
            "space_id": space_id,
            "user_id": user_id,
            "coverage_pct": coverage_pct,
            "syllabus_topics": topics,
            "syllabus_concept_count": concept_count,
            "generated_at": generated_at,
        }


class FakeProfileRepo:
    """In-memory stand-in for ``profiles``."""

    def __init__(self) -> None:
        self.profiles: dict[str, dict] = {}

    def get_profile(self, user_id: str) -> dict | None:
        return self.profiles.get(user_id)

    def get_by_username(self, username: str) -> dict | None:
        return next((p for p in self.profiles.values() if p.get("username") == username), None)

    def username_taken(self, username: str) -> bool:
        return any(p.get("username") == username for p in self.profiles.values())

    def upsert_profile(self, row: dict) -> None:
        self.profiles[row["id"]] = {**self.profiles.get(row["id"], {}), **row}

    def update_streak(
        self, *, user_id: str, current_streak: int, longest_streak: int, last_active_date: str
    ) -> None:
        if user_id in self.profiles:
            self.profiles[user_id].update(
                current_streak=current_streak,
                longest_streak=longest_streak,
                last_active_date=last_active_date,
            )


class FakeProfileSettingsRepo:
    """In-memory stand-in for ``profile_settings``."""

    def __init__(self) -> None:
        self.settings: dict[str, dict] = {}

    def get(self, *, user_id: str) -> dict | None:
        return self.settings.get(user_id)

    def upsert(self, *, user_id: str, profile_public: bool) -> None:
        self.settings[user_id] = {"user_id": user_id, "profile_public": profile_public}


class FakeCollaboratorRepo:
    """In-memory stand-in for ``source_collaborators``."""

    def __init__(self) -> None:
        self.grants: dict[tuple[str, str], dict] = {}
        # Wired by the `collaborator_repo` fixture for joined reads.
        self._space_repo: FakeSpaceRepo | None = None
        self._profile_repo: FakeProfileRepo | None = None

    def add(self, *, source_id: str, space_id: str, user_id: str, invited_by: str) -> dict:
        key = (source_id, user_id)
        if key in self.grants:
            raise RuntimeError("duplicate key value violates unique constraint (23505)")
        self.grants[key] = {
            "id": str(uuid4()),
            "source_id": source_id,
            "space_id": space_id,
            "user_id": user_id,
            "invited_by": invited_by,
            "created_at": datetime.now(UTC).isoformat(),
        }
        return self.grants[key]

    def remove(self, *, source_id: str, user_id: str) -> None:
        self.grants.pop((source_id, user_id), None)

    def is_collaborator(self, *, source_id: str, user_id: str) -> bool:
        return (source_id, user_id) in self.grants

    def list_for_source(self, *, source_id: str) -> list[dict]:
        out = []
        for (sid, uid), row in self.grants.items():
            if sid != source_id:
                continue
            profile = self._profile_repo.profiles.get(uid) if self._profile_repo else None
            out.append(
                {
                    **row,
                    "profiles": {
                        "username": profile.get("username") if profile else None,
                        "full_name": profile.get("full_name") if profile else None,
                    },
                }
            )
        return out

    def list_for_user(self, *, user_id: str) -> list[dict]:
        out = []
        for (sid, uid), row in self.grants.items():
            if uid != user_id:
                continue
            source = self._space_repo.sources.get(sid) if self._space_repo else None
            space = None
            if source and self._space_repo:
                space = self._space_repo.spaces.get(source["space_id"])
            elif self._space_repo:
                space = self._space_repo.spaces.get(row["space_id"])
            nested_source = dict(source) if source else None
            if nested_source and space:
                nested_source["spaces"] = {"id": space["id"], "name": space["name"]}
            out.append({**row, "sources": nested_source, "spaces": space})
        return out


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

    async def summarize_structured(
        self, *, title: str, extract: str  # noqa: ARG002
    ) -> StructuredSummary:
        return StructuredSummary(
            tldr=[f"{title} point {i}" for i in range(1, 6)],
            key_concepts=[f"{title} concept"],
            examples=[f"{title} example"],
            interview_points=[f"Explain {title}"],
        )

    async def chat_reply(
        self, *, title: str, source_type: str, summary: str, extract: str, history: list[dict]
    ) -> str:  # noqa: ARG002
        return f"Reply grounded in: {extract[:200]}"

    async def infer_syllabus_coverage(
        self, *, space_name: str, goal_text: str | None, concept_labels: list[str]  # noqa: ARG002
    ) -> list[SyllabusTopic]:
        """Half the captured concepts are "covered", plus two uncovered gaps —
        enough variation for tests to assert both branches without hand-tuning
        each fixture's concept count."""
        covered = [SyllabusTopic(label=label, covered=True) for label in concept_labels]
        gaps = [
            SyllabusTopic(label=f"{space_name} gap A", covered=False),
            SyllabusTopic(label=f"{space_name} gap B", covered=False),
        ]
        return covered + gaps

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
def profile_repo() -> FakeProfileRepo:
    from app.config import get_settings

    repo = FakeProfileRepo()
    dev_user_id = str(get_settings().dev_user_id)
    repo.profiles[dev_user_id] = {
        "id": dev_user_id,
        "username": "dev",
        "full_name": "Dev User",
        "current_streak": 0,
        "longest_streak": 0,
        "last_active_date": None,
    }
    return repo


@pytest.fixture
def profile_settings_repo() -> FakeProfileSettingsRepo:
    return FakeProfileSettingsRepo()


@pytest.fixture
def collaborator_repo(
    space_repo: FakeSpaceRepo, profile_repo: FakeProfileRepo
) -> FakeCollaboratorRepo:
    repo = FakeCollaboratorRepo()
    repo._space_repo = space_repo
    repo._profile_repo = profile_repo
    return repo


@pytest.fixture
def concept_repo(space_repo: FakeSpaceRepo) -> FakeConceptRepo:
    repo = FakeConceptRepo()
    repo._space_repo = space_repo
    return repo


@pytest.fixture
def coverage_repo(space_repo: FakeSpaceRepo) -> FakeCoverageRepo:
    repo = FakeCoverageRepo()
    space_repo._coverage_repo = repo
    return repo


@pytest.fixture
def note_repo() -> FakeNoteRepo:
    return FakeNoteRepo()


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
    coverage_repo: FakeCoverageRepo,
    profile_repo: FakeProfileRepo,
    profile_settings_repo: FakeProfileSettingsRepo,
    collaborator_repo: FakeCollaboratorRepo,
    note_repo: FakeNoteRepo,
    embedding_service: FakeEmbeddingService,
    llm_service: FakeLLMService,
    pipeline_service: FakePipelineService,
) -> TestClient:
    from app.config import get_settings
    from app.dependencies import (
        get_chunk_repo,
        get_concept_service,
        get_coverage_service,
        get_embedding_service,
        get_llm_service,
        get_note_service,
        get_pipeline_service,
        get_plan_service,
        get_profile_repo,
        get_profile_service,
        get_sharing_service,
        get_source_chat_service,
    )
    from app.services.coverage_service import CoverageService
    from app.services.extract_service import ExtractService
    from app.services.note_service import NoteService
    from app.services.plan_service import PlanService
    from app.services.profile_service import ProfileService
    from app.services.sharing_service import SharingService
    from app.services.source_chat_service import SourceChatService
    from app.services.streak_service import StreakService

    app = create_app()

    settings = get_settings()
    space_svc = SpaceService(space_repo, collaborator_repo)  # type: ignore[arg-type]
    session_svc = SessionService(space_repo, space_svc)  # type: ignore[arg-type]
    streak_svc = StreakService(profile_repo)  # type: ignore[arg-type]
    extract_svc = ExtractService(storage)  # type: ignore[arg-type]
    concept_svc = ConceptService(
        concept_repo, space_svc, extract_svc, llm_service  # type: ignore[arg-type]
    )
    capture_svc = CaptureService(
        settings, storage, space_svc, streak_svc, concept_svc  # type: ignore[arg-type]
    )
    coverage_svc = CoverageService(
        coverage_repo, concept_repo, space_svc, llm_service  # type: ignore[arg-type]
    )
    plan_svc = PlanService(coverage_svc, space_svc)  # type: ignore[arg-type]
    sharing_svc = SharingService(
        collaborator_repo, space_svc, profile_repo  # type: ignore[arg-type]
    )
    chat_svc = SourceChatService(
        space_svc, extract_svc, llm_service, embedding_service, chunk_repo  # type: ignore[arg-type]
    )
    note_svc = NoteService(note_repo, space_svc, storage, settings)  # type: ignore[arg-type]
    profile_svc = ProfileService(
        profile_repo, profile_settings_repo, space_repo  # type: ignore[arg-type]
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
    app.dependency_overrides[get_coverage_service] = lambda: coverage_svc
    app.dependency_overrides[get_plan_service] = lambda: plan_svc
    app.dependency_overrides[get_profile_repo] = lambda: profile_repo
    app.dependency_overrides[get_sharing_service] = lambda: sharing_svc
    app.dependency_overrides[get_profile_service] = lambda: profile_svc
    app.dependency_overrides[get_embedding_service] = lambda: embedding_service
    app.dependency_overrides[get_llm_service] = lambda: llm_service
    app.dependency_overrides[get_source_chat_service] = lambda: chat_svc
    app.dependency_overrides[get_note_service] = lambda: note_svc
    # The real pipeline calls Anthropic/Hugging Face over the network — never run it
    # from the capture path in tests; dedicated pipeline tests exercise the
    # real graph directly against fakes instead.
    app.dependency_overrides[get_pipeline_service] = lambda: pipeline_service

    return TestClient(app)
