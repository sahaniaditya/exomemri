/**
 * Background service worker boot: wires the typed message router.
 *
 * This is the extension's only network/auth surface. The popup and content
 * script reach it exclusively through these typed messages.
 */
import type { CaptureResult } from "../lib/messaging"
import { onMessage } from "../lib/messaging"
import { parseStoredSession } from "../lib/session-blob"
import { clearSession, writeSession } from "../lib/session-store"
import { captureActiveTab } from "./capture"
import { fetchSession, listSpaces, setActiveSpace } from "./session"

// Origins allowed to push a session into the extension. Keep in sync with the
// bridge content script's `matches` (src/entrypoints/atlas-bridge.content.ts).
const TRUSTED_WEB_ORIGINS = new Set([
  "http://localhost:3000",
  "https://atlas-ai-puce-xi.vercel.app",
])

function isTrustedSender(sender: { origin?: string; url?: string }): boolean {
  const raw = sender.origin ?? sender.url
  if (!raw) return false
  let host: string
  try {
    const url = new URL(raw)
    if (TRUSTED_WEB_ORIGINS.has(url.origin)) return true
    host = url.hostname
  } catch {
    return false
  }
  // Any atlas.ai (sub)domain, for the future custom production domain.
  return host === "atlas.ai" || host.endsWith(".atlas.ai")
}

export function bootBackground(): void {
  onMessage("getSession", () => fetchSession())
  onMessage("listSpaces", () => listSpaces())
  onMessage("setActiveSpace", async ({ data }) => {
    await setActiveSpace(data)
    return { ok: true }
  })
  onMessage("captureActiveTab", () => captureActiveTab())

  // Session bridge from the web app. Data is untrusted page content: verify the
  // sender's origin AND re-validate the blob before persisting.
  onMessage("syncSession", async ({ data, sender }) => {
    if (!isTrustedSender(sender)) return { ok: false }
    const blob = parseStoredSession(data)
    if (!blob) return { ok: false }
    await writeSession(blob)
    return { ok: true }
  })
  onMessage("clearSession", async ({ sender }) => {
    if (!isTrustedSender(sender)) return { ok: false }
    await clearSession()
    return { ok: true }
  })

  // Test hook: lets the E2E drive the capture from the service worker without
  // opening the browser-action popup (harmless — the SW global is not
  // reachable from web pages).
  ;(globalThis as unknown as { __atlasCaptureActiveTab?: () => Promise<CaptureResult> })
    .__atlasCaptureActiveTab = captureActiveTab
}
