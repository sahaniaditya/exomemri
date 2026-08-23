---
name: frontend-code
description: Use whenever writing, adding, or modifying frontend code in this repo (frontend/src/**) — pages, components, BFF API routes, or lib helpers. Enforces the BFF-proxy boundary, component/style separation, and DRY extraction so frontend changes come out production-ready and consistent with the rest of the dashboard.
---

# Frontend code (`frontend/src`)

Next.js (App Router) + React 19 + Tailwind v4, deployed to Vercel. Read the
root `CLAUDE.md` "Frontend — BFF proxy" section too — this skill turns it
into a checklist for writing and organizing frontend code.

## Folder map — put code where it belongs, never inline

```
frontend/src/
  app/
    <route>/page.tsx        Route entry — server component by default, fetches
                             data, composes components. Keep it thin.
    <route>/layout.tsx       Shared chrome for a route segment.
    api/<domain>/route.ts    BFF proxy routes ONLY — read the httpOnly cookie,
                             forward to the backend via apiFetch, return JSON.
                             No business logic beyond that.
  components/
    <domain>/<Name>.tsx      One component per file, PascalCase filename
                             matching the export. Group by domain/route
                             (components/dashboard/*), not by type.
    <domain>/<domain>.module.css   CSS Modules scoped to that component group.
  lib/                       Framework-agnostic helpers: API clients, session
                             bridge, data shaping. No JSX here.
  utils/                     Third-party client wiring (e.g. utils/supabase/).
```

A component doing data-fetching AND layout AND business logic in one file is
a sign it needs to be split along those three lines, not a sign the file is
"just how big this feature is."

## The BFF-proxy rule, precisely

- Client components (`'use client'`) call **local** `/api/...` routes only —
  never the backend directly, never carry a bearer token in client state.
- Every `app/api/*/route.ts` handler: read `atlas_token` from
  `cookies()`, call `apiFetch(endpoint, options, token)` from `lib/api.ts`,
  and pass the backend's status/JSON straight through. It is a thin proxy —
  if you find yourself adding a conditional beyond "no token → 401" or
  "backend errored → surface it," that logic belongs in the backend, not
  here.
- `apiFetch` already forces `cache: "no-store"` — never override that for an
  auth/profile/session call; a stale cached response there is exactly what
  causes login/onboarding redirect loops.
- Server components may call `apiFetch` directly (they hold the cookie via
  `cookies()`); client components may not — that split is the entire reason
  the proxy layer exists.

## Component structure — separation and reuse

1. **Server-first**: default every new route/page to a server component.
   Add `'use client'` only to the specific leaf component that needs
   interactivity (state, effects, event handlers, browser APIs) — see
   `NewSpaceDialog.tsx` as the pattern: it's a client component *because* it
   owns a form and a native `<dialog>`, not because the whole page is client.
2. **One component, one responsibility**: a component either fetches/orchestrates
   or renders — avoid a component that does both a data fetch, a transform,
   and a complex render. Push data shaping into `lib/` (see
   `lib/dashboard-data.ts` supplying `StatCard[]` to `StatsRow`) so the
   component just maps props to markup.
3. **Extract on the second repetition, not the third guess**: if you're about
   to copy-paste a chunk of JSX (a card, a stat tile, a form field group) to
   use it a second time, stop and pull it into its own component in the
   relevant `components/<domain>/` folder first. Don't pre-build a component
   for something used exactly once "in case it's reused later."
4. **Props over duplication**: when two components differ only by data, make
   one component parameterized by props (as `StatsRow` takes `stats:
   StatCard[]` and maps over it) rather than hand-writing near-identical
   markup twice.
5. **Composition over configuration**: prefer composing small components
   (`Sidebar`, `TopBar`, `StatsRow`, `CaptureFeed`) inside a page over one
   large component with a dozen boolean/variant props controlling what
   renders.
6. **Naming**: component file name = the component's exported name,
   PascalCase, matching what's already in `components/dashboard/` (
   `SpacesGrid.tsx`, `ResumeCard.tsx`, `WeekTimeline.tsx`) — don't introduce
   `index.tsx` files or a different casing convention for new components.

## Styles — separation, precisely

- Component-scoped styling uses a **CSS Module** colocated with its component
  group (`components/dashboard/dashboard.module.css`, imported as `styles`
  and referenced as `styles.thing`) — this repo shares one module per domain
  folder rather than one file per component; follow that existing pattern
  for new dashboard components instead of creating a new module per file.
- Tailwind utility classes are available (Tailwind v4 via `@tailwindcss/postcss`)
  for one-off layout/spacing on pages/route-level markup; reach for a CSS
  Module class instead of a long inline `className` string once a component
  has more than a few style rules or the styling is domain-specific
  (dashboard visuals, forms) rather than generic layout.
- Never inline a `style={{ ... }}` object for anything static — that's what
  the CSS Module or a Tailwind class is for. Reserve inline `style` for truly
  dynamic, computed-at-render values only.
- Don't duplicate a style rule across two `.module.css` files — if two
  domains need the same look, either share the class from one module or lift
  it into `globals.css` as a utility, not copy-pasted CSS.
- Conditional classes: compose with a template string or small helper
  (`` `${styles.d} ${cond ? styles.up : ''}` `` as in `StatsRow.tsx`) — don't
  reach for a new classnames dependency for something this simple.

## DRY and redundancy — concrete triggers to extract

- **Repeated fetch/error-handling shape** (loading state, try/catch, status
  checks like `res.status === 401`) appearing in more than one client
  component → extract a small hook (`lib/use<Thing>.ts`) or a shared helper
  in `lib/`, don't retype the same status-code branching per form.
- **Repeated markup shape** (a stat block, a card with title+value+delta, a
  labeled form field) → a component, parameterized by props, placed in the
  owning domain folder.
- **Repeated data transform** (shaping a backend response into what a
  component renders) → a function in `lib/dashboard-data.ts` (or the
  relevant `lib/*.ts`), imported by every component that needs that shape —
  never recompute the same derived value inside two components.
- **Repeated constants/copy** (route paths, cookie names, event names) →
  a single exported constant, not a string literal typed twice. The session
  bridge's key/event names are the sharpest example of why: they're
  duplicated *across packages* (`frontend` and `extension`) on purpose and
  documented as such — don't let a third, slightly different copy appear
  inside a component.

## Production-readiness checklist for every change

- Every user-facing async action (form submit, fetch) has a loading state, a
  handled error state, and a handled empty state — no silent failure, no
  unhandled promise rejection. Match the explicit status-code branching shown
  in `NewSpaceDialog.submit` (401 vs. 409 vs. generic failure) rather than a
  single generic catch-all message when the distinction matters to the user.
- No bearer tokens, service keys, or Supabase service-role credentials ever
  appear in client-side code, `NEXT_PUBLIC_*` env vars, or console logs.
- Every new client/server boundary crossing double-checked: a `'use client'`
  file never imports something that only works server-side (`next/headers`,
  server-only Supabase client, `apiFetch` with a raw cookie token).
- Accessibility basics on new interactive markup: `<label htmlFor>` paired
  with input `id` (as in `NewSpaceDialog`), keyboard-operable controls, native
  elements (`<dialog>`, `<button>`) preferred over custom widgets when they
  do the job.
- `npm run lint` and `npm run build` both pass before calling a change done —
  the build catches type errors and server/client boundary violations that
  lint alone won't.
- If a change touches `lib/extension-session.ts`, the mirrored file
  `extension/src/lib/session-blob.ts` is updated in the same change — these
  two are a single contract split across packages.

## Don't

- Don't fetch the backend directly from a `'use client'` component — go
  through a proxy route.
- Don't add a new `app/api/*` route that contains business logic beyond
  "forward this, shape the error" — that logic belongs in the backend
  service layer.
- Don't hand-roll a new state-management library or global store for
  something a couple of `useState`s and prop-drilling one level already
  solve.
- Don't create a one-off inline style or a new CSS file per component when an
  existing domain `.module.css` already covers that area — extend it.
- Don't leave a copy-pasted block of JSX/markup in two places "for now" —
  extract it as part of the same change, not as a follow-up.
