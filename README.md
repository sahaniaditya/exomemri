<div align="center">

# atlas<span>.</span>ai

### **Never lose anything you learn online again.**

Atlas captures every video, article, and AI chat you learn from, understands it,
and remembers it for you — so you can recall or connect anything, instantly.

<sub>Works right inside your browser · Save with one click · No copy-paste, ever.</sub>

<br/>

![Phase](https://img.shields.io/badge/phase-0%20·%20capture-2C5D4F)
![Backend](https://img.shields.io/badge/backend-FastAPI%20·%20Python%203.12-2C5D4F)
![Web](https://img.shields.io/badge/web-Next.js%2016%20·%20React%2019-2C5D4F)
![Extension](https://img.shields.io/badge/extension-MV3%20·%20WXT-2C5D4F)
![CI](https://img.shields.io/badge/CI-GitHub%20Actions-2C5D4F)

</div>

---

## The problem

You learn from everywhere now — YouTube, blogs, docs, ChatGPT, PDFs. But your
learning is scattered across a dozen tabs and tools, and three days later it's gone.

> _"There was an amazing explanation of consistent hashing… where was it?"_

It was never about taking notes. Note apps give you another empty page.
**What you need is memory.**

## The solution

One **Learning Space** per topic. Every source flows into it automatically.
Then AI works across all of it at once.

| | | |
| --- | --- | --- |
| **1 · Capture** | See something worth learning? Click once. | Videos, articles, AI chats, and PDFs saved into the right topic. |
| **2 · Understand** | Atlas summarizes each source instantly. | Key concepts pulled out and merged across sources into one picture. |
| **3 · Recall** | Ask your memory anything. | Answers from your own material, with citations back to the exact moment. |

### Core features

| | Feature | What it does |
| --- | --- | --- |
| `F1` | **One-click capture** | Save any page, video, or AI conversation into a topic without breaking flow. |
| `F2` | **Learning Spaces** | Start with a goal, not a blank page. Everything you consume files itself. |
| `F3` | **Instant AI summaries** | Key points, core concepts, examples — useful immediately, not a to-read pile. |
| `F4` | **Self-merging knowledge** | Three videos and an article on load balancers become one connected note. |
| `F5` | **Ask your memory** | Chat across everything you've saved, with citations that jump you back. |
| `F6` | **Know what you know** | Coverage, weak areas, and what to study next — a tutor, not a filing cabinet. |
| `F7` | **Learn while you browse** | _"You already know 70% of this — here's the 30% that's new."_ |
| `F8` | **Review that sticks** | Quizzes, flashcards, and spaced repetition from your own material. |

> **Shipped today:** `F1` capture (YouTube · articles · AI chats · PDFs) plus auth,
> onboarding, and the web app shell. `F3`–`F8` are the Phase 1+ roadmap below.

---

## Architecture

```
                          User
            browses/captures │ reads/chats
                 ┌───────────┴───────────┐
          Chrome Extension          Next.js Web App
             (MV3 · WXT)             (App Router)
                 │  POST /v1/sources      │  auth · dashboard
                 └───────────┬────────────┘
                       FastAPI Backend        ──enqueue──▶  Redis + Arq   ⟨Phase 1+⟩
                         (stateless)                            │
                 ┌───────────┴───────────┐               Pipeline Workers
                 ▼                       ▼              (chunk→embed→summarize)
          Supabase Storage        Supabase Postgres              │
        (immutable raw blobs)      (auth · profiles)     LLM + embedding APIs
```

**Governing constraint — capture is synchronous and fast; intelligence is asynchronous.**
The capture endpoint never calls an LLM. It persists, acks, and returns (`p95 < 300 ms`).

**Principles:** layered backend (`router → service → repository`) · one brain in the
extension (only the background worker holds auth) · pure, unit-testable extractors ·
API types generated from OpenAPI, never hand-written · least privilege (clients never
hold storage credentials).

### Repository layout

```
atlas.ai/
├── backend/      FastAPI capture + auth API  ·  deployed on Render
│   └── app/      routers · services · repositories · schemas · tests
├── frontend/     Next.js 16 web app  ·  deployed on Vercel
│   └── src/app/  landing · login · signup · onboarding · dashboard
├── extension/    MV3 browser extension (WXT + React)
│   └── src/      background (brain) · content · popup · lib/extractors
├── supabase/     SQL migrations (profiles schema, username check)
└── docs/         IMPLEMENTATION_PLAN.md  ·  HLD/LLD design doc
```

---

## Quickstart

**Prerequisites:** Python 3.12+, Node 22+, a Supabase project with a **private**
storage bucket named `atlas-artifacts`.

<details open>
<summary><b>1 · Backend</b> — <code>http://localhost:8000</code></summary>

```bash
cd backend
python -m venv venv
venv/Scripts/pip install -r requirements.txt      # Windows; use venv/bin on *nix
venv/Scripts/uvicorn app.main:app --reload
```

`backend/.env` (git-ignored):

```ini
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
```

</details>

<details open>
<summary><b>2 · Web app</b> — <code>http://localhost:3000</code></summary>

```bash
cd frontend
npm install
npm run dev
```

`frontend/.env.local`:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

</details>

<details open>
<summary><b>3 · Extension</b> — hot-reloading dev browser</summary>

```bash
cd extension
npm install
npm run gen:types      # regenerate src/lib/types.ts from ../backend/openapi.json
npm run dev            # WXT opens a Chrome window with the extension loaded
```

`extension/.env` — `WXT_BACKEND_URL` (default `http://localhost:8000`).

**Loading a production build manually:**
`npm run build` → `chrome://extensions` → enable **Developer mode** →
**Load unpacked** → select `extension/.output/chrome-mv3`.

Capture flow: click the toolbar icon → **Save this page**. The background worker
asks the active tab's content script to extract the page, then persists it.

</details>

---

## API surface (`/v1`)

All routes require `Authorization: Bearer <supabase-jwt>`.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/v1/auth/login` | Email/password sign-in → Supabase JWTs |
| `POST` | `/v1/auth/logout` | Revoke the current session |
| `GET` | `/v1/auth/me` | Authenticated user's profile row |
| `GET` | `/v1/auth/profile-status` | Whether onboarding is complete |
| `GET` | `/v1/auth/check-username` | Whether a username is taken |
| `POST` | `/v1/auth/profile` | Upsert the authenticated user's profile |
| `GET` | `/v1/session` | Current user + active space |
| `POST` | `/v1/session/active` | Set the active space |
| `POST` | `/v1/sources` | Capture a text source → raw artifact in Storage |
| `POST` | `/v1/sources/upload-url` | Pre-signed upload for PDFs |

**Error envelope:** `{ "error": { "code", "message", "detail?" } }` —
validation `422` · auth `401` · forbidden `403` · not found `404` · conflict `409` ·
rate limit `429` · unexpected `500`.

**Storage layout** — per-user prefix first, so access scopes and GDPR deletion are one-shot:

```
atlas-artifacts/users/{user_id}/spaces/{space_id}/sources/{source_id}/
   raw/transcript.json   raw/page.html   raw/extracted.txt   raw/chat.json   original.pdf
```

---

## Testing & checks

Every command below runs in CI on push to `main`/`dev` and on every PR
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

**Backend**

```bash
cd backend
venv/Scripts/ruff check app scripts
venv/Scripts/pytest
venv/Scripts/python scripts/dump_openapi.py   # regenerate openapi.json (contract gate)
```

**Extension**

```bash
cd extension
npm run lint
npm run typecheck
npm run test      # vitest — pure extractor units against DOM fixtures
npm run build     # production MV3 build → .output/chrome-mv3
npm run e2e       # Playwright capture-flow gate (needs the build above)
```

**Web app**

```bash
cd frontend
npm run lint
npm run build
```

> CI fails the build if `openapi.json` or the generated `src/lib/types.ts` drift —
> the extension and the endpoint can never diverge silently.

---

## Deployment

| Surface | Platform | Notes |
| --- | --- | --- |
| Backend | **Render** | Root dir `backend`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, health check `/health`. See [`render.yaml`](backend/render.yaml). |
| Web app | **Vercel** | Next.js App Router; `NEXT_PUBLIC_*` env vars set in the dashboard. |
| Database & storage | **Supabase** | Migrations in [`supabase/migrations/`](supabase/migrations) belong to the Supabase project, not to Render. |
| Extension | **Chrome Web Store** | `npm run zip` produces the MV3 upload artifact. |

Backend env vars on Render: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
`CORS_EXTENSION_ORIGINS`, `CORS_WEB_ORIGINS`, `CORS_ALLOW_ANY_EXTENSION=false`, `ENV=production`.
CORS origins are scheme + host only — **no trailing slash or path**.

---

## Roadmap

| Phase | Deliverable | Status |
| --- | --- | --- |
| **0 — Capture** | Extension captures YouTube / article / AI-chat / PDF → raw artifact in storage, via a thin FastAPI endpoint. Auth, onboarding, and web shell. | ✅ Shipped |
| **1 — Persistence + pipeline** | Postgres data model + Alembic; capture also inserts + enqueues; Arq workers run chunk → embed → summarize → extract → resolve. | ⏳ Next |
| **2 — Read + web app** | Spaces, sources, and summaries read APIs; live status polling in the dashboard. | ○ Planned |
| **3 — Intelligence** | Concept resolution, RAG chat with citations, coverage and gaps. | ○ Planned |
| **Future** | Spaced repetition (FSRS), knowledge tracing, syllabus-based coverage, mobile. | ○ Planned |

Full engineering contract: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)
· Component docs: [backend](backend/README.md) · [extension](extension/README.md)

---

## Contributing

Trunk-based development with short-lived branches and conventional commits.
PRs need green CI and one review. Every schema change ships a migration —
no manual database edits.

<div align="center">
<sub>© 2026 Atlas.ai · Your AI learning memory</sub>
</div>
