╭─── Claude Code v2.1.220 ─────────────────────────────────────────────────────╮
│                                      │ Tips for getting started              │
│         Welcome back aditya!         │ Run /init to create a CLAUDE.md file… │
│                                      │ ───────────────────────────────────── │
│                ▐▛███▜▌               │ What's new                            │
│               ▝▜█████▛▘              │ Bug fixes and reliability improvemen… │
│                 ▘▘ ▝▝                │ Added Claude Opus 5 (`claude-opus-5`… │
│                                      │ Added `sandbox.network.strictAllowli… │
│   Opus 5 · Claude Team · Kimaru AI   │ /release-notes for more               │
│          ~\Desktop\exomemri          │                                       │
╰──────────────────────────────────────────────────────────────────────────────╯

   Tackle your toughest work with Opus 5. Switch anytime with /model.

❯ /rename review-architecture 
  ⎿  Session renamed to: review-architecture

● Auto mode lets Claude handle permission prompts automatically — Claude
  checks each tool call for risky actions and prompt injection before 
  executing. Actions Claude identifies as safe are executed, while 
  actions Claude identifies as risky are blocked and Claude may try a 
  different approach. Ideal for long-running tasks. Sessions are 
  slightly more expensive. Claude can make mistakes that allow harmful 
  commands to run, it's recommended to only use in isolated 
  environments. Shift+Tab to change mode.

❯ review the architecture of this project from system desing perspective and    
  coding principles                                                             

● I'll explore the codebase structure first.

  Read 40 files, listed 1 directory, ran 2 shell commands (ctrl+o to expand)
  ⎿  Loaded frontend\CLAUDE.md
  ⎿  Loaded frontend\AGENTS.md

● Architecture Review — exomemri

  Reviewed: backend/ (FastAPI), frontend/ (Next.js App Router), extension/
  (MV3/WXT), supabase/, CI. I read the source, not just the README.

  What's genuinely well done

  The core architectural bets are correct and, unusually, actually enforced in
  the code rather than just asserted in a doc.

  - Layering is real. router → service → repository holds without leaks. Routers
  are 5-line delegators (routers/sources.py:20-36), services hold
  orchestration, and the Supabase SDK appears in exactly three files
  (repositories/*). That's a genuinely clean dependency-inversion boundary —
  CaptureService takes a StorageRepo by constructor injection, which is why
  conftest.py:27 can substitute a FakeStorage duck type with zero mocking
  library.
  - Contract as a build artifact. Pydantic → openapi.json → generated types.ts,
  with CI failing on drift (.github/workflows/ci.yml:23-31,46-50). This is the
  single best decision in the repo — the client/server contract cannot silently
  diverge.
  - "One brain" in the extension is enforced structurally, not by convention:
  the popup and content script only speak typed messages (lib/messaging.ts), and
  lib/api.ts (the only network surface) is imported solely by background
  modules. Extractors are pure (doc, url) => capture functions, which is why
  they unit-test against static HTML fixtures with no browser.
  - Storage key ordering (users/{uid}/spaces/{sid}/sources/{sid}/) puts the
  tenant discriminator first, so access scoping and GDPR delete are prefix
  operations. Right call, made early.
  - Uniform error envelope with a proper exception hierarchy (errors.py) and a
  catch-all that never leaks internals.

  Findings, ranked

  1. The auth client uses the service-role key — least-privilege violation

  repositories/supabase_client.py:22-37: get_auth_client() and
  get_service_client() call the same _create(), which builds with
  supabase_service_key. So every JWT verification and every user login runs
  through a client whose apikey header is the service-role key — a key that
  bypasses all RLS.

  This directly contradicts the module's own docstring ("a fresh client per
  call, used ONLY to verify a user's JWT... so it can't leak session state").
  Session state isn't the risk; privilege is. auth.get_user(token) and
  sign_in_with_password only need the anon key. As written, any code path that
  later does a table read off get_auth_client() silently gets superuser access.

  Fix: add supabase_anon_key to Settings and build the auth client from it.

  2. Every authenticated request constructs a new Supabase client

  Same file, line 36 — get_auth_client() is unmemoized by design, and
  dependencies.py:62 calls it on every request. Each call constructs a full
  Client: new httpx pools for postgrest, storage, auth, realtime. On a p95-300ms
  budget that's meaningful fixed overhead plus unbounded socket churn under
  load, on a Render free plan.

  Worse, it's a network round-trip to Supabase Auth on every single request to
  validate the JWT. Supabase JWTs are HS256-signed with a known secret — verify
  them locally with pyjwt and you drop a synchronous external dependency out of
  your hot path entirely. Right now your capture endpoint's availability is
  coupled to Supabase Auth's uptime, not just Storage's.

  3. RLS policies exist but are entirely bypassed

  migrations/...profiles_schema.sql:21-34 enables RLS with correct auth.uid() = 
  id policies. ProfileRepo uses the service-role client, which bypasses RLS
  unconditionally. So the policies are dead code today — defense-in-depth that
  provides zero defense.

  The mitigation is at auth_service.py:68 ("id": user_id, # bound to the 
  authenticated token), which is correct — but it's a single-line convention
  protecting the whole tenancy model. One future repo method that accepts a
  client-supplied id is a full cross-tenant read. Either route user-scoped reads
  through an RLS-respecting client (service key for admin ops only), or make it
  structurally impossible for a repo method to take an unbound id.

  4. space_id is client-supplied and never authorized

  capture_service.py:97 takes payload.space_id straight into the storage path.
  Nothing checks the space exists or belongs to the caller. Today the blast
  radius is contained — the path is
  users/{authenticated_uid}/spaces/{arbitrary}/..., so a user can only pollute
  their own namespace. But the moment Phase 1 adds a spaces table with a FK,
  this becomes an IDOR unless an ownership check lands with it. Worth an
  explicit # Phase 1: authorize space ownership marker at the call site so it
  isn't discovered later.

  5. SessionService is in-process mutable state on a stateless service

  session_service.py:21 — self._active_space: dict[UUID, UUID], held in an
  @lru_cached singleton (dependencies.py:22). The README calls the backend
  "stateless"; this makes it not. Two consequences, both live today:

  - Render scales to >1 instance → POST /session/active and the next GET 
  /session hit different workers and disagree.
  - Any restart silently resets every user's active space.

  It's honestly documented as a Phase 0 stub, so it's a known debt, not a
  mistake. But setActiveSpace in the extension (background/session.ts:43-53)
  does write→read-back against this, treating it as durable, and the write is
  lost on restart with no signal. Given a profiles table already exists, an
  active_space_id column would remove the whole class of problem for near-zero
  cost.

  6. No token refresh anywhere in the system

  Grep confirms it: refresh tokens are minted, stored in a cookie
  (auth-session.ts:32), forwarded to the extension (bridge-session/route.ts:31),
  persisted in the blob (session-blob.ts:49) — and never redeemed. There is no
  code path anywhere that calls refresh_session.

  Concretely: the access cookie has maxAge: 3600. At T+1h the user is
  hard-bounced to /login by dashboard/layout.tsx:17 despite holding a valid
  7-day refresh token. The extension is worse — it silently fails capture with
  "Session expired — reopen exomemri to refresh" (background/capture.ts:19),
  which is a UX workaround standing in for the missing refresh. The expires_at
  field is computed and stored (extension-session.ts:53) but never read by
  anything.

  This is the largest functional gap in the auth design. Both surfaces need it;
  the extension's background worker is the natural place (it's already the only
  session holder).

  7. apiFetch's localStorage fallback is dead and misleading

  frontend/src/lib/api.ts:4 falls back to localStorage.getItem("atlas_token").
  Nothing ever writes that key — the whole architecture deliberately keeps the
  token in httpOnly cookies. So on the client this branch always yields null,
  producing an unauthenticated request instead of an obvious failure. It also
  invites exactly the pattern the cookie design exists to prevent. Delete the
  fallback and make token a required parameter — this function is server-only in
  practice, and the type should say so.

  8. No unbounded-payload limit on capture

  schemas/sources.py:33-34 — content and raw_html are str | None with no
  max_length, while title/author are properly bounded. A single POST can carry
  an arbitrarily large HTML page; each one is .encode()d fully in memory and
  shipped to Storage. On a free-tier instance that is a trivially reachable
  memory-exhaustion vector, and there's no rate limiting either (RateLimitError
  is defined in errors.py:53 but never raised anywhere).

  9. CI does not build the frontend

  The workflow has backend and extension jobs only. The README (line 203) states
  "Every command below runs in CI" and then lists cd frontend && npm run lint 
  && npm run build. It doesn't. The frontend also has no typecheck script, so TS
  errors reach production unless next build catches them — and nothing runs
  next build in CI. Given the frontend has the highest concentration of loose
  typing in the repo (err: any at onboarding/page.tsx:288, untyped res.json()
  throughout), this is the gap I'd close first mechanically.

  10. Auth gating is duplicated across four layouts

  dashboard/layout.tsx, onboarding/layout.tsx, login/layout.tsx,
  signup/layout.tsx each independently read the cookie and hit
  /v1/auth/profile-status. The dashboard version alone is ~35 lines of redirect
  logic. This is the exact case Next.js middleware exists for; without it, each
  new protected route re-implements the gate and the four copies drift. It also
  costs an extra backend round-trip per navigation on the critical path.

  11. Broad except Exception in services

  auth_service.py:38, 51, 78, storage_repo.py:51, 70. Ruff's BLE rule is enabled
  and these are all # noqa-suppressed. The intent — normalize SDK errors at the
  boundary — is right, but at auth_service.py:79-80 it degenerates into
  string-matching the exception text for "23505" to detect a unique-constraint
  violation. That's parsing an error message as an API. Postgrest returns a
  structured code; match on that.

  12. Minor

  - capture_service.py:91 logs a client/server content_hash mismatch and
  proceeds. Since this is the future idempotency key, a mismatch is a real
  client bug that will be invisible in aggregate. Consider rejecting, or at
  minimum a metric.
  - _write_artifacts (capture_service.py:124) is an if/elif chain on SourceType.
  Fine at 4 branches; becomes a strategy-map candidate at 6+.
  - _absolute_upload_url (capture_service.py:181-187) papers over storage3
  URL-shape variance, as does storage_repo.py:75 for signed_url/signedUrl. Both
  are version-sniffing workarounds. Pin supabase to an exact version — the whole
  requirements file is >=-only, which for a deploy target is a reproducibility
  hazard.
  - TRUSTED_WEB_ORIGINS (background/index.ts:16) is hardcoded and must stay in
  sync with the bridge content script's matches and with CORS_WEB_ORIGINS on
  Render — three places, comment-enforced. Trusted production origins must
  stay an explicit allowlist (no wildcard product suffix).
  - CORS_ALLOW_ANY_EXTENSION defaults to true (config.py:43). Correctly set to
  false in render.yaml, but an insecure-by-default that relies on remembering
  the override.

  Summary

  The skeleton is better than the flesh. Boundaries, dependency direction, and
  the contract pipeline are the things that are expensive to retrofit, and
  they're done properly — Phase 1 can be built on this without demolition.
  What's weak is concentrated in auth (#1, #2, #3, #6) and in the frontend,
  which reads as noticeably less disciplined than the backend and extension:
  inline styles, no CI, duplicated gates, any.

  If I were picking three: #6 token refresh (a user-visible bug shipping today),
  #1/#2 the auth client (a security and hot-path issue in one 15-line file),
  and #9 frontend CI (cheapest fix, and it's the surface with the least type
  safety).

✻ Cooked for 2m 30s