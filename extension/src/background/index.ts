/**
 * Background service worker boot: wires the typed message router.
 *
 * This is the extension's only network/auth surface. The popup and content
 * script reach it exclusively through these typed messages.
 */
import type { CaptureResult } from "../lib/messaging"
import { onMessage } from "../lib/messaging"
import { captureActiveTab } from "./capture"
import { fetchSession, setActiveSpace } from "./session"

export function bootBackground(): void {
  onMessage("getSession", () => fetchSession())
  onMessage("setActiveSpace", async ({ data }) => {
    await setActiveSpace(data)
    return { ok: true }
  })
  onMessage("captureActiveTab", () => captureActiveTab())

  // Test hook: lets the E2E drive the capture from the service worker without
  // opening the browser-action popup (harmless — the SW global is not
  // reachable from web pages).
  ;(globalThis as unknown as { __atlasCaptureActiveTab?: () => Promise<CaptureResult> })
    .__atlasCaptureActiveTab = captureActiveTab
}
