---
name: backend-code
description: Use whenever writing, adding, or modifying backend code in this repo (backend/app/**) — new endpoints, services, repositories, schemas, or fixing bugs there. Enforces the router→service→repository layering, DRY/OOP/SOLID discipline, and the openapi/types contract gate so backend changes come out production-ready and CI-green on the first try.
---

# Backend code (`backend/app`)

FastAPI backend, strict layering: **router → service → repository**. Nothing
skips a layer. Read `backend/CLAUDE.md` and the root `CLAUDE.md` architecture
section too — this skill operationalizes them into a checklist.

## Folder map — put code where it belongs, never inline

```
backend/app/
  routers/       HTTP only. Parse via Depends, call one service method, return the schema.
  services/      All business logic, orchestration, authorization decisions.
  repositories/  Only place that touches Supabase/Postgres/Storage. No logic.
  schemas/       Pydantic request/response + shared enums. Source of truth for OpenAPI.
  dependencies.py  DI wiring — every provider function lives here, nowhere else.
  errors.py      AppError hierarchy + handlers. Never invent ad-hoc error JSON.
  config.py      Settings (env vars) only.
  tests/         One test module per router/service, using the fake repos from conftest.py.
```

A change that doesn't fit this map is a sign you're skipping a layer — stop
and re-place it rather than bolting logic onto the wrong file.

## The layering rule, precisely

- **Router**: unpacks `Depends(...)`, calls exactly one service method, returns
  the response model. No `if`/`try` business logic, no direct repo/DB calls,
  no auth logic beyond the `Depends` chain. See `routers/sources.py` — every
  handler is a one-line delegation.
- **Service**: a class taking its collaborators (repos, other services,
  `Settings`) as constructor args (constructor injection, not globals or
  module-level singletons). Holds every business rule: ownership checks,
  idempotency, validation that needs domain knowledge, orchestration across
  repos. Services may call other services (e.g. `CaptureService` holds a
  `SpaceService`) — never call a repository owned by another service directly.
- **Repository**: thin wrapper over one Supabase concern (`space_repo`,
  `profile_repo`, `storage_repo`). Every query filters by the authorization
  boundary explicitly (`user_id`, or ownership already verified above it) —
  the service-role client bypasses RLS, so the repo is where that filter has
  to live. No business logic, no branching on domain rules — just data access
  methods with clear names (`get_space`, `slug_exists`, `upsert_source`).

## Adding a new endpoint — the actual sequence

1. **Schema first** (`schemas/<domain>.py`): define the request/response
   Pydantic models. These are the OpenAPI/contract source of truth — write
   them before any implementation, with `Field` constraints (`min_length`,
   `max_length`, etc.) doing validation, not manual checks in the service.
2. **Repository method(s)** if new data access is needed: add a narrow method
   to the relevant `*_repo.py`, filtered by the owning user/space id. Don't
   add a generic "run arbitrary query" method — every method name should read
   like a use case.
3. **Service method**: implement the business logic as a method on the
   relevant service class (or a new service class if this is a new domain —
   one service per bounded concern, not one god-service). Authorize *before*
   any write (check ownership first, exactly like
   `CaptureService._require_owned_space` is called before any storage write).
   Raise `AppError` subclasses from `errors.py` for anything exceptional
   (`ValidationError`, `ForbiddenError`, `NotFoundError`, `ConflictError`) —
   never return error dicts or raise bare exceptions from a service.
4. **Wire DI** in `dependencies.py`: add a `get_<thing>_repo()` /
   `get_<thing>_service()` provider that composes the object graph via
   `Depends(...)` chains, mirroring the existing `get_capture_service`
   pattern. This is what makes the service testable with fakes.
5. **Router**: add the endpoint, `Depends` in the service (and
   `get_authenticated_app_user` for auth), one-line delegate to the service
   method, correct `response_model` and `status_code`.
6. **Tests**: add/extend a test module in `tests/`, overriding the DI
   providers with fakes as `conftest.py` already does — services and routers
   must be tested without hitting real Supabase.
7. **Contract gate — do this in the same change, not after**:
   ```bash
   cd backend && venv/Scripts/python scripts/dump_openapi.py
   cd extension && npm run gen:types
   ```
   CI fails if these drift. If you touched a router or a schema, this step is
   not optional.
8. **Lint**: `venv/Scripts/ruff check app scripts` — line length 100, `ANN`
   and `B`/`BLE` are enforced. Every public function needs type annotations.
   A bare `except Exception:` needs `# noqa: BLE001` with a reason inline.

## Principles to actually apply, not just cite

**DRY**
- If two services need the same authorization check or the same data shape,
  extract a shared method on the owning service/repo — don't copy the query.
  `SpaceService.require_owned_space` / `require_owned_source` exist precisely
  so `CaptureService` doesn't reimplement ownership checks.
- Shared enums/constants (`SourceType`, `ProcessingStatus`) live once in
  `schemas/common.py` and are imported everywhere — never redefine a
  parallel string-literal version in a service.

**OOP / SOLID**
- **SRP**: one service class per bounded concern (capture, spaces, session,
  auth). If a service file is accumulating unrelated responsibilities, split
  it into a new service rather than growing a god-class.
- **Dependency Inversion**: services depend on repository *classes* passed in
  via constructor, never import `supabase_client` directly — that's what
  makes `conftest.py`'s fake repos work. Only files under `repositories/`
  import the Supabase client.
- **Open/closed via allowlists, not conditionals-on-input**: when accepting a
  client-controlled string that maps to server behavior (an artifact key, a
  storage path segment), validate against a closed `frozenset` allowlist
  (see `capture_service.ALLOWED_ARTIFACT_KEYS`) rather than sanitizing/regex
  matching. Adding a new case means adding to the allowlist, not patching
  validation logic.
- Favor small, composable methods on a service (`_write_meta`,
  `_write_artifacts`, `_record_source` as private helpers on
  `CaptureService`) over one long method — but don't extract a helper that's
  called from only one place for no reason; only split when it clarifies a
  distinct step or enables reuse.

**Production-readiness checklist for every change**
- Authorization happens before any side effect (write, storage upload, row
  insert) — check ownership first, always.
- Errors raised are `AppError` subclasses with an accurate HTTP status; never
  let an unexpected `Exception` leak a stack trace (the global handler in
  `errors.py` already catches truly-unexpected ones as 500 — don't
  swallow/hide errors you should be raising as a typed `AppError` instead).
- Structured logging (`logger.info("event_name", extra={...})`) on
  significant state changes (a row created, a mismatch detected) — snake_case
  event names, structured `extra`, not string-interpolated messages.
- Idempotency where the domain calls for it: re-running a capture with the
  same content should not create a duplicate row (`upsert` on the natural
  unique key, as `space_repo.upsert_source` does) — check whether new
  write paths need the same treatment.
- Sync Supabase SDK calls made from an `async def` service method are
  offloaded with `anyio.to_thread.run_sync(partial(...))` (see
  `CaptureService._require_owned_space`) — never block the event loop with a
  raw sync call inside an async route.
- No secrets, tokens, or PII in log lines or error `detail` payloads.
- New tables: migration file in `supabase/migrations/`, keep `sources.type`
  (or any CHECK constraint) in sync with the corresponding schema enum, and
  cascade deletes so removing a user/space cleans up dependents automatically
  (per `backend/CLAUDE.md`). Split a table once it would exceed ~10 columns
  rather than growing it indefinitely.

## Don't

- Don't call a repository from a router, or from a service that doesn't own
  it.
- Don't hand-edit `extension/src/lib/types.ts` — it's generated.
- Don't add a new artifact/storage key without adding it to the relevant
  allowlist first.
- Don't add defensive validation for inputs that Pydantic schemas or FastAPI
  routing already guarantee — validate once, at the boundary.
- Don't introduce a new pattern (a different DI style, a different error
  shape, a repo that skips the `user_id` filter) because it's locally
  convenient — match the existing shape even if you'd design it differently
  greenfield.
