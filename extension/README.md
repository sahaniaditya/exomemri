# Atlas Extension (Phase 0)

MV3 browser extension (WXT + React + TypeScript) that captures a source from a
supported page and writes its raw artifact to storage via the Atlas capture
backend. See [`docs/IMPLEMENTATION_PLAN.md`](../docs/IMPLEMENTATION_PLAN.md).

## Architecture

- **One brain** — only `src/background/` holds the session and talks to the
  network/storage. `src/content/` and `src/popup/` are dumb UI that send typed
  messages (`src/lib/messaging.ts`).
- **Pure extractors** — `src/lib/extractors/` turn a DOM into a normalized
  capture payload with no side effects, so they are unit-tested in jsdom.
- **Generated contract** — `src/lib/types.ts` is generated from the backend
  OpenAPI schema (`npm run gen:types`); never hand-edit it.
- WXT requires browser entrypoints under `src/entrypoints/`; those are thin
  adapters that delegate into the modules above.

## Develop

```bash
npm install
npm run gen:types   # regenerate types from ../backend/openapi.json
npm run dev         # launches a dev browser with the extension loaded
```

Set the backend URL in `.env` (`WXT_BACKEND_URL`, default `http://localhost:8000`).

## Checks

```bash
npm run lint
npm run typecheck
npm run test        # vitest: extractor units
npm run build       # production MV3 build -> .output/chrome-mv3
npm run e2e         # Playwright capture-flow gate (needs the built extension)
```
