/**
 * Phase 0 Definition-of-Done gate.
 *
 * Loads the built extension into Chromium, opens a served article page, and
 * drives the popup's Save action (via the background's capture entry) — the
 * background asks the tab's content script to extract, then persists. Asserts
 * the capture hit POST /v1/sources with the expected payload.
 */
import { fileURLToPath } from "node:url"

import { type BrowserContext, chromium, expect, test, type Worker } from "@playwright/test"

import { startMockBackend, type MockBackend } from "./mock-backend"

type CaptureResult = { ok: boolean; source_id?: string; error?: string }

const EXTENSION_PATH = fileURLToPath(new URL("../../.output/chrome-mv3", import.meta.url))

// The session the web app would have mirrored into localStorage and the bridge
// content script relayed into the extension. Seeded directly into
// storage.local here so the capture path has an active space + bearer token.
const SESSION_BLOB = {
  version: 1,
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  user: { id: "00000000-0000-0000-0000-0000000000a1", email: "aditya@kimaru.ai" },
  space_id: "00000000-0000-0000-0000-0000000000b1",
  space_name: "System Design",
  expires_at: 9999999999,
  updated_at: 1700000000,
}

let backend: MockBackend
let context: BrowserContext

async function backgroundWorker(): Promise<Worker> {
  const existing = context.serviceWorkers()[0]
  return existing ?? (await context.waitForEvent("serviceworker"))
}

test.beforeAll(async () => {
  backend = await startMockBackend(8000)
  // MV3 extensions require the new headless mode (channel: "chromium").
  context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [
      "--no-sandbox",
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  })
  await backgroundWorker()
})

test.afterAll(async () => {
  await context?.close()
  await backend?.close()
})

test("captures the active tab's article and returns Saved", async () => {
  // Open the article page and make it the active tab.
  const page = await context.newPage()
  await page.goto("http://localhost:8000/article")
  await page.bringToFront()
  // Give the content script a moment to register its extractor.
  await page.waitForTimeout(500)

  // Seed the logged-in session the bridge would normally relay from the web app.
  const sw = await backgroundWorker()
  await sw.evaluate(async (blob) => {
    const g = globalThis as unknown as {
      chrome: { storage: { local: { set: (items: object) => Promise<void> } } }
    }
    await g.chrome.storage.local.set({ "atlas.session": blob })
  }, SESSION_BLOB)

  // Drive the exact path the popup's "Save this page" button triggers.
  const result = (await sw.evaluate(() => {
    const g = globalThis as unknown as {
      __atlasCaptureActiveTab: () => Promise<CaptureResult>
    }
    return g.__atlasCaptureActiveTab()
  })) as CaptureResult

  expect(result.ok).toBe(true)
  expect(result.source_id).toBeTruthy()

  // The capture actually hit the backend with the expected shape.
  const captures = backend.requests.filter((r) => r.path === "/v1/sources")
  expect(captures).toHaveLength(1)
  const body = captures[0]!.body as Record<string, unknown>
  expect(body.type).toBe("article")
  expect(body.space_id).toBe("00000000-0000-0000-0000-0000000000b1")
  expect(typeof body.content_hash).toBe("string")
  expect((body.content as string).length).toBeGreaterThan(0)
})
