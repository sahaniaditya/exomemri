# Atlas Backend (Phase 0)

Thin FastAPI capture endpoint. Phase 0 scope: accept a source capture and
write its raw artifact to Supabase Storage. No Postgres, no queue, no LLM.
See [`docs/IMPLEMENTATION_PLAN.md`](../docs/IMPLEMENTATION_PLAN.md).

Layering: `router → service → repository`. Only `repositories/storage_repo.py`
touches Supabase. The session is a dev-stub (`dependencies.get_current_user`)
so the capture flow is exercisable locally; real auth arrives in Phase 2.

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
| GET | `/v1/session` | Current user + active space (dev-stub) |
| POST | `/v1/session/active` | Set active space |
| POST | `/v1/sources` | Capture a text source → raw artifact in Storage |
| POST | `/v1/sources/upload-url` | Pre-signed upload for PDFs |

## Checks

```bash
venv/Scripts/ruff check app scripts
venv/Scripts/pytest
venv/Scripts/python scripts/dump_openapi.py   # regenerate openapi.json (contract)
```
