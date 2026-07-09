# Atlas — Implementation Plan

> Derived from `extension/atlas-hld-lld.md.pdf` (System Design Document, HLD & LLD, v0.1).
> This plan translates that design into an actionable, phased engineering contract.

| Field | Value |
| --- | --- |
| Plan version | 1.0 |
| Source design | Atlas HLD/LLD v0.1 (draft, "For review") |
| Status | Proposed — pending sign-off on §11 (Open Questions & Assumptions) |
| Primary deliverable | **Phase 0 (Starter): `extension/` folder only** |
| Owner audience | Backend, frontend, and infra engineers |

---

## 1. Feature Scope & Objectives

### 1.1 Product in one line
Atlas is an AI learning memory that **captures, understands, and remembers** everything a person learns online. Captured sources (YouTube videos, web articles, AI chats, PDFs, notes) are stored as immutable raw artifacts, then asynchronously turned into summaries, searchable chunks, and a connected concept graph scoped to a **Space** (a goal-scoped learning container).

### 1.2 The governing constraint
> **Capture is synchronous and fast; intelligence is asynchronous.**
Every design decision optimizes the *felt latency* of the save. The capture endpoint never calls an LLM — it persists, enqueues, and returns immediately.

### 1.3 Phase 0 (Starter) — the only thing we build first
The starter is intentionally tiny and is the focus of this plan's actionable work:

- **In scope:** the `extension/` folder captures a source and writes its raw artifact to S3-compatible storage, backed by a **thin capture endpoint** (FastAPI) whose only job is to accept/sign the upload to S3.
- **Definition of Done (Phase 0):** From a supported page, the auto-capture card saves the source, the raw artifact lands in S3 under the user's prefix, and the extension shows a **"Saved ✓"** confirmation. That is the entire Phase 0.
- **Explicitly out of scope for the starter:** pipeline, summaries, chunks, concepts, chat, coverage, the web app, and Postgres — all Phase 1+.

**Per-source-type capture (Phase 0):**

| Source type | Captured detail | Raw artifact written to S3 |
| --- | --- | --- |
| YouTube | title, url, channel/author, duration, full transcript (with timestamps) | `raw/transcript.json` |
| Web article | title, url, author, cleaned article text (Readability) | `raw/page.html` + `raw/extracted.txt` |
| AI chat | title, url, full message thread (role + text) | `raw/chat.json` |
| PDF | title, url/filename, the file itself | `original.pdf` (pre-signed PUT) |

Common metadata on every capture: `user_id` (from auth), `space_id` (active space), `type`, `captured_at`, `content_hash`.

### 1.4 Objectives (full product, phased)
1. One-click, zero-friction capture from the browser into an active Space.
2. Turn every captured source into an instant summary and a searchable, connected knowledge base.
3. Model what the user knows (coverage, gaps, "you already know 70% of this").
4. Keep capture free: the user's click returns instantly; intelligence is computed in the background.

### 1.5 Non-goals (this revision)
- No mobile client.
- No verbatim resurfacing of copyrighted source text (summaries, highlights, and links only).
- No quiz/flashcard scheduling engine yet (schema leaves room for it via `next_review_at`).

---

## 2. System Architecture & Design Patterns

### 2.1 System context (target)
```
                 User
   browses/captures │ reads/chats
        ┌───────────┴───────────┐
  Chrome Extension          Next.js Web App
        │ POST /v1/sources        │ reads / chat
        └───────────┬────────────┘
              FastAPI Backend  ──enqueue──▶  Redis Queue (Arq)
              (stateless)                         │
        ┌───────────┼───────────┐          Pipeline Workers
        ▼           ▼           ▼            (summarize/embed)
   S3 Object   Postgres +   LLM + Embedding APIs
     Store      pgvector    (Anthropic Claude + cheap tier + embeddings)
```

### 2.2 Components & responsibilities

| Component | Tech | Responsibility |
| --- | --- | --- |
| Extension | MV3, **WXT**, React, TS | Detect capturable content, auto-surface capture card, send captures. No business logic beyond capture. Background worker is the only auth holder. |
| Web app | Next.js (App Router) | Browse spaces, read summaries, chat, coverage/gaps. Reads derived data only. *(Phase 1+)* |
| API (ingestion + read) | FastAPI | Auth, validation, fast capture ack, raw persistence, job enqueue, read APIs, RAG orchestration. **Stateless.** |
| Object store | S3 / R2 / Supabase Storage | Immutable raw artifacts, keyed per user. Source of truth for re-processing. |
| Relational store | Postgres + pgvector | All structured, queryable data + vector index. Frontend's read source. *(Phase 1+)* |
| Queue | Redis + Arq worker | Durable hand-off from sync capture to async processing. *(Phase 1+)* |
| Pipeline workers | Python (shares app package) | chunk → embed → summarize → extract → resolve → update state. Idempotent, retryable. *(Phase 1+)* |
| LLM providers | Anthropic Claude + cheap model + embedding model | Summaries/chat/quiz (Claude); extraction/tagging (cheap model); vectors (embedding model). *(Phase 1+)* |

### 2.3 Architectural principles (enforced)
1. **Separation of concerns by layer.** Router → Service → Repository → Model. No business logic in routers; no SQL in services.
2. **Sync capture / async intelligence.** The capture endpoint never calls an LLM — it persists + enqueues + returns `202`.
3. **Two-store split.** Blobs in S3 (immutable, cheap, replayable); structured data in Postgres (queryable). Never store large text in Postgres rows; never query S3 on the hot path.
4. **Stateless API.** No in-memory session state; horizontal scale by default. State lives in Postgres/Redis/S3.
5. **Idempotent, replayable workers.** Every pipeline stage can re-run safely, keyed by `source_id` + `content_hash`.
6. **One brain in the extension.** Only the background worker touches auth/API; content scripts are dumb UI.
7. **Least privilege.** Clients never hold S3 credentials; access via short-lived pre-signed URLs scoped to the user prefix.
8. **Fail visibly, degrade gracefully.** Processing failures surface as a source status, never a lost capture.

### 2.4 Extension architecture rules (Phase 0 — enforced)
- **One brain.** Only `background/` holds the session and talks to the network. `content/` and `popup/` are dumb UI that send typed messages to the background worker.
- **Extractors are pure.** DOM → payload transforms in `lib/extractors/` take input and return a payload with no side effects, so they are unit-testable without a browser.
- **No secrets in content scripts.** Content scripts share the page's world; they never see the session token or S3 credentials.
- **Types come from the backend.** The capture payload type is generated from the backend's OpenAPI schema so the extension and endpoint never drift.

### 2.5 Design patterns in play
| Pattern | Where | Purpose |
| --- | --- | --- |
| Layered architecture | Backend (router/service/repo/model) | Testability, single responsibility |
| Dependency Injection | FastAPI `Depends` (db session, current user, services) | Test overrides, decoupling |
| Repository pattern | Backend data access | Isolate ORM from business logic |
| Message-passing / mediator | Extension `content ↔ background` typed messages | "One brain" isolation |
| Pure-function transform | Extension extractors (DOM → payload) | Deterministic, unit-testable |
| Producer/consumer (queue) | Capture → Arq → workers | Decouple sync capture from async intelligence |
| State machine | `processing_status` lifecycle | Reliable, resumable pipeline |
| Idempotent consumer | Pipeline stages keyed by `source_id`/`content_hash` | Safe retries |

---

## 3. Module Breakdown & Dependencies

### 3.1 Repository structure (target)
```
atlas/
  extension/            # Phase 0: the only folder we build now
    wxt.config.ts       # MV3 manifest, permissions, host_permissions
    src/
      background/       # the "brain": the ONLY holder of auth + S3/API calls
        index.ts        # service-worker entry; message router
        session.ts      # reads /v1/session, caches active space (chrome.storage.session)
        capture.ts      # builds payload, calls capture endpoint, uploads to S3
      content/          # per-site content scripts (dumb UI; no auth)
        youtube/        # transcript + metadata extraction
        article/        # Readability extraction
        ai-chat/        # thread extraction
        capture-card/   # the auto-surfacing capture card (React)
      popup/            # space switcher UI (React)
      lib/
        api.ts          # typed client for the capture endpoint
        extractors/     # pure functions: DOM → normalized capture payload
        types.ts        # capture payload types (generated from backend OpenAPI)
      messaging.ts      # typed content↔background message contracts
    tests/              # vitest (extractors) + Playwright (capture flow)
    package.json
  backend/              # SEPARATE service — starter uses only its capture endpoint
  frontend/             # SEPARATE service — Phase 1+
```

### 3.2 Phase 0 module map & internal dependencies

| Module | Depends on | Notes |
| --- | --- | --- |
| `content/*/` extractors call | `lib/extractors/` (pure) | Content scripts extract DOM, delegate to pure functions |
| `content/capture-card/` | `messaging.ts` | React UI; sends `{type: CAPTURE, ...}` to background |
| `popup/` | `messaging.ts` | Space switcher; sends `SET_ACTIVE_SPACE` |
| `background/index.ts` | `session.ts`, `capture.ts`, `messaging.ts` | Message router / mediator |
| `background/session.ts` | `lib/api.ts`, `chrome.storage.session` | Reads `/v1/session`, caches active space |
| `background/capture.ts` | `lib/api.ts` | Builds payload, calls capture endpoint, uploads to S3 (small via API, PDF via pre-signed PUT) |
| `lib/api.ts` | `lib/types.ts` (generated) | Typed HTTP client; `credentials: "include"` |
| `lib/types.ts` | backend OpenAPI schema | **Generated, never hand-written** |

### 3.3 External/tooling dependencies (Phase 0)
- **WXT** (MV3 framework), React, TypeScript (strict).
- **@mozilla/readability** (article extraction) — or equivalent.
- **Vitest** (extractor unit tests), **Playwright** (capture E2E).
- **openapi-typescript** (or codegen equivalent) for `lib/types.ts`.
- Thin **FastAPI** capture endpoint (Pydantic v2, aioboto3/boto3 for S3, pydantic-settings).

> ⚠️ **Drift to reconcile (see §11):** the current `extension/` is scaffolded with **Plasmo**, not WXT; `popup.tsx` is the default template; `host_permissions` is `https://*/*`. The current `backend/requirements.txt` carries LangChain/LangGraph/OpenAI/Supabase rather than the design's Anthropic/Arq/SQLAlchemy stack.

### 3.4 Phase 1+ backend modules (forward design)
`domains/sources/` (schemas, router, service, repository), `workers/pipeline/` (Arq tasks, stages), concept resolution, RAG chat, plus Alembic migrations for the data model in §4 below.

---

## 4. Data Flow & Integration Points

### 4.1 Write path — capture (Phase 0 form)
```
Extension card ──{type: CAPTURE, url, title, text}──▶ Extension worker
Extension worker ──POST /v1/sources (cookie auth, credentials: include)──▶ FastAPI
FastAPI: authenticate → user_id, validate payload
FastAPI ──PutObject raw artifact (users/{id}/spaces/{space}/sources/{id}/raw/...)──▶ S3
FastAPI ──202 {source_id, processing_status: queued}──▶ Extension worker
Extension card: toast "Saved ✓"
```
- **Phase 0:** `POST /v1/sources` **only writes the raw artifact to S3 and returns** — no Postgres row, no enqueue.
- **Phase 1+:** same call additionally `INSERT sources (status=queued, raw_s3_key)` and `enqueue process_source(source_id)`.
- **Large files (PDF):** obtain a pre-signed PUT via `POST /v1/sources/upload-url`, then the client uploads directly to S3.

### 4.2 Read path — open a space (Phase 1+)
```
Next.js ──GET /v1/spaces/{id}/sources──▶ FastAPI ──SELECT sources JOIN summaries WHERE space_id──▶ Postgres
Next.js: render sources[] (ready = summary shown, queued = processing)
Next.js: subscribe/poll GET /v1/sources/{id} for status flip on queued sources (TanStack Query)
```

### 4.3 API surface (v1)
Base `/v1`; auth via `atlas_session` cookie; uniform error envelope.

| Method | Path | Purpose | Success | Phase |
| --- | --- | --- | --- | --- |
| GET | `/session` | Current user + active space | 200 | **0** |
| POST | `/session/active` | Set active space `{space_id}` | 204 | **0** |
| POST | `/sources` | Capture a source (starter: write raw S3) | 202 | **0** |
| POST | `/sources/upload-url` | Pre-signed PUT for PDFs | 200 | **0** |
| POST | `/spaces` | Create space `{name, goal_text}` | 201 | 1+ |
| GET | `/spaces` | List user's spaces | 200 | 1+ |
| GET | `/spaces/{id}/sources` | Sources + summaries (+ status) | 200 | 1+ |
| GET | `/spaces/{id}/coverage` | Coverage / gap report | 200 | 1+ |
| POST | `/spaces/{id}/chat` | RAG chat `{query}` → answer + citations | 200 | 1+ |
| GET | `/sources/{id}` | Source detail + status | 200 | 1+ |
| GET | `/sources/{id}/original` | Pre-signed GET to raw | 200 | 1+ |
| POST | `/notes` | Create note/highlight | 201 | 1+ |

**Capture contract (`CaptureRequest`):** `space_id: UUID`, `type: SourceType`, `url: HttpUrl?`, `title: str (1..500)`, `author: str?`, `content: str?` (small text payloads), `anchor: dict?`. **Response:** `{source_id: UUID, processing_status: "queued"}`.

**Error envelope:** `{ "error": { "code", "message", "detail?" } }`. Code→HTTP: validation→422, auth→401, forbidden→403, not found→404, conflict→409, rate limit→429, unexpected→500.

### 4.4 Object storage layout
```
s3://atlas-artifacts/
  users/{user_id}/
    spaces/{space_id}/
      sources/{source_id}/
        raw/transcript.json   # youtube
        raw/page.html         # article
        raw/extracted.txt     # normalized text
        raw/chat.json         # ai chat
        original.pdf          # pdf (presigned upload)
```
- **Per-user prefix first** → IAM/pre-signed scoping to `users/{id}/*`, one-shot GDPR deletion, natural sharding.
- Small text payloads sent through the API (`PutObject`); large files (PDF) via pre-signed PUT.
- Reads always via short-lived pre-signed GET minted by the API; clients never hold credentials.

### 4.5 Auth & session (Phase 0 relevant)
- On web login, API issues an opaque session token cookie: `atlas_session=<opaque>; Domain=.atlas.ai; Secure; HttpOnly; SameSite=None; Max-Age=...`. Server stores only `token_hash` (SHA-256) in `auth_sessions`.
- **Extension handshake:** `host_permissions: ["https://*.atlas.ai/*"]`; background worker calls API with `credentials: "include"`; browser attaches cookie. `GET /v1/session` → `{ user, active_space }`. `401` → extension shows signed-out state.
- **Active space** is server state (`learning_sessions.active_space_id`), set via `POST /v1/session/active` from web or popup.
- **CSRF:** web app uses double-submit CSRF token on state-changing calls; extension cross-origin calls authenticated by cookie + Origin allow-listing.

### 4.6 Data model (Phase 1+ reference)
Postgres, UUID PKs via `gen_random_uuid()`, all timestamps `timestamptz`. Tables: `users`, `auth_sessions` (index on `token_hash`), `learning_sessions` (active space per user), `spaces`, `sources` (indexes on `space_id`, `(user_id, processing_status)`, `content_hash`), `chunks` (`vector(1536)`, HNSW `vector_cosine_ops`), `summaries` (1:1 with source), `concepts` (HNSW, unique `(space_id, canonical_name)`), `source_concepts`, `user_concept_state`, `notes`, `events`.

Enums: `source_type = {youtube, article, ai_chat, pdf, note}`; `processing_status = {queued, fetching, chunking, embedding, summarizing, extracting, ready, failed}`.

### 4.7 Async pipeline (Phase 1+ reference)
State machine: `queued → fetching → chunking → embedding → summarizing → extracting → ready`; any → `failed`. Entrypoint `process_source(ctx, source_id)`; idempotent re-entry (no-op if `ready`); chunk (target 800 tokens, overlap 100) → embed (batch, cached by content hash) → summarize (Claude) → extract concepts (cheap model) → resolve concepts (per-space advisory lock) → bump exposure → emit `source_ready` event → set `ready`. Retries: Arq exponential backoff; poison → `failed` + error (capture never lost; re-queueable).

---

## 5. Testing Strategy

### 5.1 Phase 0 (extension)
- **Unit (Vitest):** `lib/extractors/` pure functions — feed saved DOM fixtures (YouTube page, article, AI chat), assert normalized payloads. This is the highest-value test surface because extractors are pure and browser-free.
- **Component (Vitest + RTL):** capture-card and popup rendering/interaction.
- **E2E (Playwright):** the full capture flow — load a supported page → auto-capture card appears → save → assert `POST /v1/sources` fired and "Saved ✓" toast shows. Mock or stub the endpoint for deterministic runs.
- **Contract:** `lib/types.ts` is generated from the backend OpenAPI schema; CI fails if generated types drift from the committed ones.

### 5.2 Backend (thin capture endpoint, Phase 0 → 1+)
- **Unit (pytest + pytest-asyncio):** services with repositories/storage mocked; verify capture writes to S3 with the correct key and returns the envelope.
- **Integration (Phase 1+):** ephemeral Postgres via testcontainers; factory fixtures for data. Coverage gate ~80% on services.
- **Contract:** OpenAPI schema diffed in CI; breaking changes fail the build.

### 5.3 Cross-cutting test principles
- Test the boundaries (payload validation, auth 401/403 paths, S3 key construction, pre-signed URL scoping).
- Deterministic fixtures over live network; no real LLM/S3 calls in CI (use mocks/localstack/minio where needed).
- Every pipeline stage (Phase 1+) has an idempotency/replay test.

---

## 6. Deployment Considerations

### 6.1 Topology
- **Frontend:** Vercel (Next.js). *(Phase 1+)*
- **API + workers:** containerized FastAPI and Arq worker as **separate services** from the **same image, different entrypoints** (Fly.io / Render / ECS).
- **Postgres + pgvector:** managed (Supabase / Neon / RDS). *(Phase 1+)*
- **Redis:** managed (Upstash / Elasticache) for the queue. *(Phase 1+)*
- **Object store:** R2 (recommended, zero egress) or S3.
- **Extension:** MV3 build → Chrome Web Store (existing `submit.yml` GitHub workflow present in `extension/.github/workflows/`).

### 6.2 Config & secrets
- 12-factor: config via `pydantic-settings` from env only; no literals for secrets/hosts.
- Platform secret manager; injected as env; **never in the repo**. (Note: `backend/.env` exists locally — confirm it is git-ignored and contains no committed secrets.)
- Dependency scanning + secret scanning in CI.

### 6.3 CI/CD
- Trunk-based with short-lived branches; conventional commits; PRs require green CI + one review.
- **Backend CI stages:** ruff → mypy (strict) → pytest (with services) → build.
- **Frontend/extension CI stages:** eslint → tsc → test → build.
- **Migrations:** every schema change ships an Alembic migration; no manual DB edits. *(Phase 1+)*

### 6.4 Non-functional targets (POC)
| Attribute | Target |
| --- | --- |
| Capture ack latency | p95 < 300 ms (persist + enqueue only) |
| Summary availability | p95 < 30 s after capture *(Phase 1+)* |
| Chat response | p95 < 5 s *(Phase 1+)* |
| Availability | 99.5% (API); queue durable across restarts |
| Data durability | S3 (11 nines) for raw; nightly Postgres backups |
| Scale | 100s of concurrent users; low-thousands sources/day |

### 6.5 Observability
- **Logs:** structured JSON (structlog) with request/trace id; per-pipeline-stage timing; never log PII or raw tokens.
- **Metrics:** capture rate, queue depth, stage durations, LLM/embedding cost per source, failure rate by stage.
- **Tracing:** OpenTelemetry across API → queue → worker.
- **Errors:** Sentry on API, workers, frontend.
- **Alerts:** queue depth, failed rate, summary-latency SLO breach.

### 6.6 Security checklist
- Cookie flags `Secure; HttpOnly; SameSite=None`; opaque tokens hashed at rest, with expiry + rotation.
- Authorization on every resource (`assert_owned`); never trust client-supplied `user_id`.
- Input validation at the boundary (Pydantic v2); output encoding on the frontend.
- Rate limiting on `POST /sources` and chat; per-user quotas.
- S3 IAM scoped to the artifact bucket; access only via pre-signed URLs bound to the user prefix.
- CSRF protection for web; Origin allow-list for the extension.

---

## 7. Coding Standards (adherence contract)

**Python / FastAPI:** Python 3.12, full type hints, mypy strict as CI gate; Ruff (lint+format, import sorting); Pydantic v2 at every boundary; layered architecture (no logic in routers, no ORM in services); async everywhere on I/O (SQLAlchemy async, aioboto3, httpx); custom exception hierarchy (`AppError` → `NotFoundError`/`AuthError`/…) mapped to the error envelope, no bare `except`; config via pydantic-settings; structured logging.

**TypeScript / extension & Next.js:** TS strict; ESLint + Prettier; no `any` without justification; feature-based folders; Zod for client-side form validation; TanStack Query for server state; **generated API types are the source of truth — never hand-write response types.**

---

## 8. Phased Delivery Roadmap

| Phase | Deliverable | Design sections |
| --- | --- | --- |
| **0 — Starter (now)** | `extension/` captures YouTube/article/AI-chat/PDF → raw artifact in S3 via thin FastAPI endpoint; "Saved ✓" toast. Endpoints: `GET /session`, `POST /session/active`, `POST /sources` (S3 write only), `POST /sources/upload-url`. | §3.1–3.4, §4.1, §4.3, §4.4, capture slice of §4.5 |
| **1 — Persistence + pipeline** | Postgres data model + Alembic; `POST /sources` also inserts + enqueues; Arq workers run chunk→embed→summarize→extract→resolve; status state machine. | §4.2, §4.6, §4.7 |
| **2 — Read + web app** | Next.js App Router; spaces/sources/summaries read APIs; live status polling. | §4.9, read APIs |
| **3 — Intelligence** | Concept resolution accuracy, RAG chat with citations, coverage/gaps. | §4.7, §4.8 |
| **Future** | Mobile retention layer, spaced-repetition (FSRS via `next_review_at`), knowledge-tracing, syllabus-based coverage. | §10 |

### 8.1 Suggested Phase 0 work sequence
1. **Reconcile scaffold** (see §11.1) — align `extension/` with WXT + correct `host_permissions`, or ratify Plasmo.
2. Stand up the thin FastAPI capture endpoint (`/session`, `/session/active`, `/sources`, `/sources/upload-url`) writing to S3-compatible storage (minio locally).
3. Generate `lib/types.ts` from the endpoint's OpenAPI schema; wire `lib/api.ts`.
4. Build pure `lib/extractors/` for YouTube, article (Readability), AI chat (+ unit tests with DOM fixtures).
5. Build `background/` brain: `session.ts` (session + active space cache), `capture.ts` (payload + S3 upload, pre-signed PUT for PDF), `index.ts` (message router).
6. Build `content/capture-card/` (auto-surface) and `popup/` (space switcher) as dumb UI over `messaging.ts`.
7. Playwright E2E for the capture flow; verify Definition of Done.

---

## 9. Risks & Mitigations

| Risk | Mitigation |
| --- | --- |
| AI-chat DOM scraping is fragile | Ship after core capture; per-service content scripts + monitoring; pure extractors with fixture tests to catch breakage fast |
| Concept resolution accuracy *(Phase 1+)* | Tune thresholds on a labeled set; per-space advisory lock; adjudication fallback |
| LLM cost at scale *(Phase 1+)* | Model split (Claude vs cheap), embedding cache by `content_hash`, batch calls, per-user cost metrics |
| pgvector at scale *(Phase 1+)* | HNSW now; migrate to dedicated vector DB only on measured strain |
| Copyright exposure | Never resurface verbatim source text; summaries + highlights + links only |
| **Scaffold drift (Plasmo vs WXT; backend deps)** | Resolve in §11 before building; pick one framework and delete the other's artifacts to avoid ambiguity |

---

## 10. Success Criteria (Phase 0)
- [ ] From a supported YouTube page, article, AI-chat page, and PDF, the auto-capture card appears and captures the correct fields.
- [ ] `POST /v1/sources` writes the correct raw artifact under `users/{id}/spaces/{space}/sources/{id}/...`.
- [ ] PDF upload uses a pre-signed PUT; the client never holds S3 credentials.
- [ ] Extension shows "Saved ✓"; capture ack p95 < 300 ms.
- [ ] Content scripts never see the session token; only `background/` performs network/auth.
- [ ] `lib/types.ts` is generated (not hand-written) and CI enforces contract parity.
- [ ] Extractor unit tests + one Playwright capture E2E pass in CI.

---

## 11. Open Questions & Assumptions

### 11.1 Scaffold drift (needs a decision before building)
1. **Extension framework — Plasmo vs WXT.** The design mandates **WXT**, but `extension/package.json` is scaffolded with **Plasmo 0.90.5** and `popup.tsx` is the default Plasmo template. *Question:* migrate to WXT (aligns with the contract) or ratify Plasmo and update the design? **Assumption until told otherwise:** we follow the design and migrate to WXT.
2. **`host_permissions` scope.** Current manifest declares `https://*/*`; the design specifies `https://*.atlas.ai/*` for the API handshake, plus targeted host permissions for capture sites (youtube.com, etc.). *Assumption:* narrow API host perms to `*.atlas.ai`, and add per-capture-site content-script matches explicitly.
3. **Backend dependencies mismatch.** `backend/requirements.txt` carries LangChain, LangGraph, OpenAI, and Supabase clients — the design specifies **Anthropic Claude**, **Arq**, **SQLAlchemy 2.0 async + Alembic**, and pgvector. *Question:* is the backend intentionally using LangGraph/OpenAI (a design deviation), or is `requirements.txt` a leftover scaffold? **Assumption:** for Phase 0 the backend is a *thin* S3-signing endpoint; the heavier deps are premature and will be reconciled at Phase 1.

### 11.2 Product / environment questions
4. **Backend ownership in Phase 0.** The design says the backend's internal structure is out of scope for the starter and it exists as "the endpoint the extension calls." *Question:* does this team build the thin capture endpoint as part of Phase 0, or is it provided externally? **Assumption:** we build a minimal FastAPI capture endpoint alongside the extension so Phase 0 is end-to-end demonstrable.
5. **Auth in local/dev.** Cookie auth assumes a deployed `*.atlas.ai` domain with a login flow. *Question:* what is the Phase 0 dev auth story (stubbed session? local login?)? **Assumption:** a dev-only `GET /session` returns a fixed test user + space so the capture flow is exercisable locally.
6. **Object store choice for Phase 0.** R2 recommended; S3 and Supabase Storage are alternatives. *Assumption:* MinIO locally, R2 for the shared dev environment.
7. **Embedding dimension.** Design shows `vector(1536)` as a placeholder "set to match the chosen embedding model." *Question (Phase 1+):* which embedding model/dimension? **Assumption:** confirm at Phase 1; keep the migration parameterized.
8. **Supported AI-chat surfaces.** *Question:* which AI-chat products must the starter support (ChatGPT, Claude.ai, Gemini)? **Assumption:** start with one (ChatGPT) and add others behind per-service content scripts.
9. **PDF capture trigger.** *Question:* is PDF capture from an in-browser PDF viewer, a file picker, or both? **Assumption:** in-browser PDF URL first; file picker later.

### 11.3 Non-blocking assumptions carried forward
- All identifiers are UUIDv4; all times are UTC `timestamptz`.
- `content_hash` = SHA-256 over `content` (or `url` when content is absent); it is the idempotency/caching key.
- Types are generated from OpenAPI into a shared location so extension and (later) web app consume identical contracts.
- Secrets are never committed; `backend/.env` must be git-ignored (verify).

---

*End of plan. Sections marked **(Phase 1+)** are retained as the forward design and are not part of the Phase 0 build.*
