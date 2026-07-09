/**
 * Phase 0 Definition-of-Done gate.
 *
 * Loads the built extension into Chromium, opens a served article page, waits
 * for the auto-surfacing capture card, clicks Save, and asserts the capture
 * hit POST /v1/sources and the card shows "Saved ✓".
 */
import { fileURLToPath } from "node:url"

import { type BrowserContext, chromium, expect, test } from "@playwright/test"

import { startMockBackend, type MockBackend } from "./mock-backend"

const EXTENSION_PATH = fileURLToPath(new URL("../../.output/chrome-mv3", import.meta.url))

let backend: MockBackend
let context: BrowserContext

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
  // Best-effort: give the background service worker a moment to register. It
  // also auto-wakes on the first message, so we don't fail if it isn't up yet.
  if (context.serviceWorkers().length === 0) {
    await context.waitForEvent("serviceworker", { timeout: 5_000 }).catch(() => {})
  }
})

test.afterAll(async () => {
  await context?.close()
  await backend?.close()
})

test("captures an article and shows Saved ✓", async () => {
  const page = await context.newPage()
  await page.goto("http://localhost:8000/article")

  // The capture card auto-surfaces (in an open shadow root; locators pierce it).
  const card = page.getByTestId("atlas-capture-card")
  await expect(card).toBeVisible()

  const save = page.getByTestId("atlas-save")
  await expect(save).toHaveText("Save")
  await save.click()

  await expect(save).toHaveText("Saved ✓")

  // The capture actually hit the backend with the expected shape.
  const captures = backend.requests.filter((r) => r.path === "/v1/sources")
  expect(captures).toHaveLength(1)
  const body = captures[0]!.body as Record<string, unknown>
  expect(body.type).toBe("article")
  expect(body.space_id).toBe("00000000-0000-0000-0000-0000000000b1")
  expect(typeof body.content_hash).toBe("string")
  expect((body.content as string).length).toBeGreaterThan(0)
})
