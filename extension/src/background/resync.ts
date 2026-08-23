/**
 * Re-read the web app's `atlas.session` from open exomemri tabs.
 *
 * Chrome does not inject content scripts into tabs that were already open when
 * the extension loaded, and reloading the extension orphans the copies that
 * were running — so the bridge cannot be the only path. `executeScript` reads
 * page localStorage regardless, which is what makes a login picked up without
 * the user refreshing anything.
 *
 * Clearing is deliberately conservative. Every `localhost` port is a trusted
 * origin in dev, so "trusted tab with no session blob" is not enough to
 * conclude signed-out — the tab must also carry the web app's `atlas.app`
 * marker. Otherwise an open `localhost:8000/docs` would sign the user out.
 */
import { browser } from "wxt/browser"

import { readTabSession } from "../lib/read-tab-session"
import { parseStoredSession, type StoredSession } from "../lib/session-blob"
import { clearSession, writeSession } from "../lib/session-store"
import { isTrustedWebOrigin } from "../lib/trusted-origin"

const BRIDGE_SCRIPT = "/content-scripts/atlas-bridge.js"

/**
 * (Re)inject the bridge so this tab relays future logins/logouts on its own.
 * Idempotent: the script rebinds itself rather than stacking listeners.
 */
async function ensureBridge(tabId: number): Promise<void> {
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: [BRIDGE_SCRIPT] })
  } catch {
    // Permission miss — the direct localStorage read above already synced.
  }
}

/** Ask every reachable exomemri tab for its session blob; newest write wins. */
export async function resyncFromWebApp(): Promise<{ ok: boolean }> {
  const [active] = await browser.tabs.query({ active: true, currentWindow: true })
  const all = await browser.tabs.query({})
  const seen = new Set<number>()
  const blobs: StoredSession[] = []
  let sawSignedOutApp = false

  for (const tab of [...all, active]) {
    if (!tab?.id || seen.has(tab.id)) continue
    seen.add(tab.id)

    const url = tab.url ?? tab.pendingUrl
    const trusted = typeof url === "string" && isTrustedWebOrigin(url)
    const isActive = tab.id === active?.id
    // The active tab is readable via `activeTab` even when its URL is hidden.
    if (!trusted && !isActive) continue

    const read = await readTabSession(tab.id)
    if (!read) continue // Unreadable: no information, so assert nothing.
    if (!read.isAppHost) continue // Not the exomemri web app.

    void ensureBridge(tab.id)
    const blob = parseStoredSession(read.raw)
    if (blob) blobs.push(blob)
    else sawSignedOutApp = true
  }

  if (blobs.length > 0) {
    blobs.sort((a, b) => b.updated_at - a.updated_at)
    const newest = blobs[0]
    if (newest) await writeSession(newest)
  } else if (sawSignedOutApp) {
    await clearSession()
  }

  return { ok: true }
}

/**
 * One tab finished loading an exomemri URL — pick its session up immediately, so
 * the popup is already correct the first time it is opened after a login.
 *
 * A missing blob here falls through to the full sweep rather than clearing:
 * this single tab may just be the pre-login page while another tab holds a
 * live session.
 */
export async function resyncFromTab(tabId: number, url: string): Promise<void> {
  if (!isTrustedWebOrigin(url)) return

  const read = await readTabSession(tabId)
  if (!read?.isAppHost) return

  void ensureBridge(tabId)
  const blob = parseStoredSession(read.raw)
  if (blob) {
    await writeSession(blob)
    return
  }
  await resyncFromWebApp()
}
