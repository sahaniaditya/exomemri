# Atlas Backend (Phase 0)

Thin FastAPI capture endpoint. Phase 0 scope: accept a source capture and
write its raw artifact to Supabase Storage. No Postgres, no queue, no LLM.
See [`docs/IMPLEMENTATION_PLAN.md`](../docs/IMPLEMENTATION_PLAN.md).

Layering: `router → service → repository`. Only `repositories/storage_repo.py`
touches Supabase. All routes verify a real Supabase JWT: `/auth` routes take the
`AuthUser` directly, while `/session` and `/sources` map it to the app's `User`
via `dependencies.get_authenticated_app_user`.

## Setup

```bash
python -m venv venv
venv/Scripts/pip install -r requirements.txt   # Windows; use venv/bin on *nix
```

`.env` (git-ignored) must define:

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
```

One-time: create a **private** Supabase Storage bucket named `atlas-artifacts`.

## Run

```bash
venv/Scripts/uvicorn app.main:app --reload   # http://localhost:8000
```

## Endpoints (v1)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/auth/login` | Email/password sign-in → Supabase JWTs |
| POST | `/v1/auth/logout` | Revoke the current session (Bearer token) |
| GET | `/v1/auth/me` | Authenticated user's profile row |
| GET | `/v1/auth/profile-status` | Whether onboarding/profile is complete |
| GET | `/v1/auth/check-username` | Whether a username is already taken |
| POST | `/v1/auth/profile` | Upsert the authenticated user's profile |
| GET | `/v1/session` | Current user + active space |
| POST | `/v1/session/active` | Set active space |
| POST | `/v1/sources` | Capture a text source → raw artifact in Storage |
| POST | `/v1/sources/upload-url` | Pre-signed upload for PDFs |

All routes require `Authorization: Bearer <supabase-jwt>`. The active space is
still backend-defaulted (`dev_space_name`) until a real spaces store lands.

## Deploy (Render)

Hosted on Render from this `backend/` directory — see [`render.yaml`](render.yaml).
`supabase/` migrations are **not** deployed here; they belong to the Supabase
project. Render config:

- **Root Directory:** `backend`
- **Build:** `pip install -r requirements.txt`
- **Start:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (also in [`Procfile`](Procfile))
- **Health check:** `/health`
- **Env vars (dashboard):** `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
  `CORS_EXTENSION_ORIGINS`, `CORS_WEB_ORIGINS`, `CORS_ALLOW_ANY_EXTENSION=false`,
  `ENV=production`

`CORS_WEB_ORIGINS` is a comma-separated list of web app origins allowed to call
the API (e.g. `https://atlas-ai-puce-xi.vercel.app`). Use scheme + host only —
**no trailing slash or path**, since the browser's `Origin` header never has one.

## Checks

```bash
venv/Scripts/ruff check app scripts
venv/Scripts/pytest
venv/Scripts/python scripts/dump_openapi.py   # regenerate openapi.json (contract)
```
