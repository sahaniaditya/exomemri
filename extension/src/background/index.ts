/**
 * Background service worker boot: wires the typed message router.
 *
 * This is the extension's only network/auth surface. The popup and content
 * script reach it exclusively through these typed messages.
 */
import { browser } from "wxt/browser"

import type { CaptureResult } from "../lib/messaging"
import { onMessage } from "../lib/messaging"
import { parseStoredSession } from "../lib/session-blob"
import { clearSession, writeSession } from "../lib/session-store"
import { isTrustedSender, isTrustedWebOrigin } from "../lib/trusted-origin"
import { captureActiveTab } from "./capture"
import { resyncFromTab, resyncFromWebApp } from "./resync"
import { fetchSession, listSpaces, setActiveSpace } from "./session"

export function bootBackground(): void {
  onMessage("getSession", () => fetchSession())
  onMessage("listSpaces", () => listSpaces())
  onMessage("setActiveSpace", async ({ data }) => {
    await setActiveSpace(data)
    return { ok: true }
  })
  onMessage("captureActiveTab", () => captureActiveTab())
  onMessage("resyncSession", () => resyncFromWebApp())

  // The popup's own read of the active tab. Page-controlled data, so it is
  // held to the same bar as the bridge: the tab must be a trusted exomemri origin
  // AND carry the web app's marker before it can seed or wipe the session.
  onMessage("ingestPageSession", async ({ data }) => {
    if (!isTrustedWebOrigin(data.url) || !data.isAppHost) return { ok: false }
    const blob = parseStoredSession(data.raw)
    if (blob) {
      await writeSession(blob)
    } else {
      await clearSession()
    }
    return { ok: true }
  })

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

  // Tabs opened before the extension loaded have no content script until a
  // refresh. Re-inject/ping exomemri tabs on install, browser start, and SW boot.
  browser.runtime.onInstalled.addListener(() => {
    void resyncFromWebApp()
  })
  browser.runtime.onStartup.addListener(() => {
    void resyncFromWebApp()
  })
  void resyncFromWebApp()

  // A login is a navigation on the exomemri origin. Picking it up here — rather
  // than waiting for the popup to be opened — is what makes the extension
  // reflect a sign-in (and a sign-out) without the user refreshing anything.
  browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return
    const url = tab.url ?? changeInfo.url
    if (typeof url === "string") void resyncFromTab(tabId, url)
  })

  // Test hook: lets the E2E drive the capture from the service worker without
  // opening the browser-action popup (harmless — the SW global is not
  // reachable from web pages).
  ;(globalThis as unknown as { __atlasCaptureActiveTab?: () => Promise<CaptureResult> })
    .__atlasCaptureActiveTab = captureActiveTab
}
