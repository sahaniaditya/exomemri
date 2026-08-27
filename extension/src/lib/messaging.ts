/**
 * Typed popup/content <-> background message contracts.
 *
 * The "one brain" rule: the popup and the content script are dumb. The popup
 * asks the background to capture the active tab; the content script only
 * extracts the current page's DOM when asked. All auth/network lives in the
 * background worker.
 */
import { defineExtensionMessaging } from "@webext-core/messaging"

import type { CreditsBalance, ExtractedCapture, SessionResponse, SpaceSummary } from "./contracts"
import type { TabSessionRead } from "./read-tab-session"
import type { StoredSession } from "./session-blob"

/** Input for a PDF capture: the background fetches + PUTs the bytes itself. */
export interface PdfCaptureInput {
  title: string
  url: string
}

/** Result of a capture attempt, surfaced by the popup. */
export type CaptureResult =
  | { ok: true; source_id: string }
  | { ok: false; error: string }

export interface ProtocolMap {
  /** Current session (user + active space). */
  getSession(): SessionResponse
  /** The user's learning spaces, for the popup's space picker. */
  listSpaces(): SpaceSummary[]
  /** Set the active learning space (from the popup). */
  setActiveSpace(spaceId: string): { ok: boolean }
  /** Remaining monthly credits. */
  getCredits(): CreditsBalance
  /** Extract the current page — handled by the content script in a tab. */
  extractCurrentPage(): ExtractedCapture | null
  /** Capture the active tab's page — handled by the background worker. */
  captureActiveTab(): CaptureResult
  /** Relay the web app's stored session (from the bridge content script). */
  syncSession(blob: StoredSession): { ok: boolean }
  /** Clear the stored session — signed out on the web app. */
  clearSession(): { ok: boolean }
  /** Popup → background: persist a localStorage read taken from the active tab. */
  ingestPageSession(payload: TabSessionRead & { url: string }): { ok: boolean }
  /** Popup → background: re-read every reachable exomemri tab. */
  resyncSession(): { ok: boolean }
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>()
