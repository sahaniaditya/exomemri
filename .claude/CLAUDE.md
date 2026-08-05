# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Atlas is an AI learning-memory product: a browser extension captures what you learn
(YouTube, articles, AI chats, PDFs) into a **Learning Space**, a FastAPI backend persists
the raw artifact, and a Next.js web app is the dashboard. Currently **Phase 0 (capture)** —
see `docs/IMPLEMENTATION_PLAN.md` for the engineering contract and phase roadmap.

Three deployable surfaces in one repo: `backend/` (Render), `frontend/` (Vercel),
`extension/` (Chrome Web Store), plus `supabase/migrations/` (owned by the Supabase project,
applied there — not by Render).

## Commands

### Backend (`cd backend`) — Python 3.11+, venv checked in at `backend/venv`
```bash
venv/Scripts/pip install -r requirements.txt     # Windows; venv/bin on *nix
venv/Scripts/uvicorn app.main:app --reload       # http://localhost:8000
venv/Scripts/ruff check app scripts
venv/Scripts/pytest
venv/Scripts/pytest app/tests/test_sources.py::test_name    # single test
venv/Scripts/python scripts/dump_openapi.py      # regenerate openapi.json
```

### Extension (`cd extension`)
```bash
npm run dev          # WXT opens a Chrome window with the extension loaded
npm run gen:types    # regenerate src/lib/types.ts from ../backend/openapi.json
npm run lint && npm run typecheck
npm run test                       # vitest — pure extractor units in jsdom
npx vitest run tests/extractors/youtube.test.ts   # single test file
npm run build        # MV3 build -> .output/chrome-mv3
npm run e2e          # Playwright capture-flow gate (requires the build first)
```

### Frontend (`cd frontend`)
```bash
npm run dev          # http://localhost:3000
npm run lint && npm run build
```

CI (`.github/workflows/ci.yml`) runs all of the above on push to `main`/`dev` and every PR.

### The contract gate — read before touching any endpoint
CI fails if `backend/openapi.json` or `extension/src/lib/types.ts` drift from source.
Any change to a backend router/schema requires, in the same commit:
1. `python scripts/dump_openapi.py` in `backend/`
2. `npm run gen:types` in `extension/`

`extension/src/lib/types.ts` is generated — never hand-edit it.

## Env vars

- `backend/.env` — `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`. Prod also needs
  `CORS_EXTENSION_ORIGINS`, `CORS_WEB_ORIGINS`, `CORS_ALLOW_ANY_EXTENSION=false`, `ENV=production`.
  CORS origins are scheme + host only — no trailing slash or path.
- `frontend/.env.local` — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BACKEND_URL`.
- `extension/.env` — `WXT_BACKEND_URL` (default `http://localhost:8000`).

A private Supabase Storage bucket named `atlas-artifacts` must exist.

## Architecture

### Governing constraint
**Capture is synchronous and fast; intelligence is asynchronous.** `POST /v1/sources` never
calls an LLM — it authorizes, persists the artifact + row, and returns (`p95 < 300 ms`).
Anything expensive belongs in the Phase 1 worker pipeline, not the capture path.

### Backend — strict `router → service → repository`
Only `repositories/` touches Supabase (`storage_repo`, `profile_repo`, `space_repo`, all built
on `supabase_client`). Services hold logic and are constructed via `dependencies.py`, which is
the DI seam the tests override — `app/tests/conftest.py` builds a hermetic app with fake
storage and a fake Postgres, so **tests never hit a real Supabase**.

Auth: every route requires `Authorization: Bearer <supabase-jwt>`, verified per-request with a
fresh auth client. `/auth` routes consume `AuthUser` directly; `/session`, `/spaces`, `/sources`
go through `get_authenticated_app_user` to get the app's `User`. Ownership, not existence,
authorizes a space — every space-scoped request checks `spaces.user_id` before any write.

Errors: raise the `AppError` subclasses in `app/errors.py` (`ValidationError` 422, `AuthError`
401, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409). Handlers registered in
`main.py` render the uniform envelope `{"error": {"code", "message", "detail?"}}` — don't
return ad-hoc error JSON from routers.

Storage keys are user-prefixed so access scoping and GDPR deletion are one-shot:
`users/{user_id}/spaces/{space_id}/sources/{source_id}/...`. Artifact keys are validated
against a closed allowlist in `capture_service.ALLOWED_ARTIFACT_KEYS` — adding a new artifact
type means adding it there, not sanitizing input.

### Extension — "one brain"
Only `src/background/` holds the session and talks to the network. `src/popup/` and
`src/content/` are dumb and communicate exclusively through the typed `ProtocolMap` in
`src/lib/messaging.ts`. WXT requires browser entrypoints under `src/entrypoints/`; those are
thin adapters that delegate into `background/`, `content/`, `popup/`.

`src/lib/extractors/` (youtube / article / ai-chat) are **pure** DOM → payload functions with no
side effects, selected by URL in `src/content/collect.ts`, unit-tested against jsdom fixtures.
Keep them pure — that's what makes them testable without a browser.

`src/lib/hash.ts` mirrors `compute_content_hash` in `capture_service.py`; the server recomputes
the authoritative hash, and it is the capture idempotency key (unique on `(space_id, content_hash)`).

### The session bridge (subtle, easy to break)
The web app keeps auth in httpOnly cookies, which the extension cannot read. So the web app
mirrors a minimal session blob into `localStorage` under `atlas.session`
(`frontend/src/lib/extension-session.ts`) and dispatches an `atlas:session-updated` window
event; the extension's `atlas-bridge.content.ts` runs only on the Atlas origin, re-reads
localStorage, revalidates via `parseStoredSession`, and relays it to the background worker
(`extension/src/lib/session-blob.ts`).

- The custom event is required: a same-tab `localStorage` write fires no `storage` event, and
  opening the toolbar popup does not make the page visible.
- The key, event name, and blob shape are duplicated in `frontend/src/lib/extension-session.ts`
  and `extension/src/lib/session-blob.ts` — **change both together**.
- Never trust the page: relayed data always goes through `parseStoredSession`.
- Extension session lives in `browser.storage.local` (not `.session`) so it survives MV3
  service-worker teardown and browser restarts.
- New web-app origins must be added to `host_permissions` in `wxt.config.ts`.

### Frontend — BFF proxy
Routes under `src/app/api/*` are thin proxies: they read the `atlas_token` httpOnly cookie and
forward to the backend via `apiFetch` so the browser never holds a bearer token. Client
components call the local `/api/...` routes, not the backend directly. `apiFetch` forces
`cache: "no-store"` — stale auth/profile responses are what cause login/onboarding redirect
loops. `lib/auth-session.ts::establishSession` is the single place both auth entry points
(Google PKCE callback and the email-link hash flow) set cookies and pick the post-login redirect.

### Database
Schema changes ship as a new file in `supabase/migrations/` — no manual database edits. The
`sources.type` CHECK constraint must stay in sync with `SourceType` in
`backend/app/schemas/common.py`. The active space is persisted as `profiles.active_space_id`.

## Conventions

- Ruff, line length 100, with `ANN` (annotations) and `B`/`BLE` enabled — public functions need
  type annotations; bare `except Exception` needs an explicit `# noqa: BLE001` with a reason.
- Trunk-based development: short-lived branches off `main`, conventional commits, green CI plus
  one review to merge.
