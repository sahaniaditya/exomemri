/**
 * Typed content/popup <-> background message contracts.
 *
 * The "one brain" rule: content scripts and the popup are dumb UI. They never
 * touch auth or the network — they send these typed messages and the
 * background worker (the only session holder) performs the privileged work.
 */
import { defineExtensionMessaging } from "@webext-core/messaging"

import type { ExtractedCapture, SessionResponse, Space } from "./contracts"

/** Input for a PDF capture: the background fetches + PUTs the bytes itself. */
export interface PdfCaptureInput {
  title: string
  url: string
}

/** Result of a capture attempt, surfaced by the capture card. */
export type CaptureResult =
  | { ok: true; source_id: string }
  | { ok: false; error: string }

export interface ProtocolMap {
  /** Capture a text source (youtube / article / ai_chat / note). */
  capture(payload: ExtractedCapture): CaptureResult
  /** Capture a PDF via the pre-signed upload flow. */
  capturePdf(payload: PdfCaptureInput): CaptureResult
  /** Current session (user + active space). */
  getSession(): SessionResponse
  /** Set the active learning space (from the popup). */
  setActiveSpace(spaceId: string): { ok: boolean }
  /** The currently active space, or null if signed out. */
  getActiveSpace(): Space | null
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>()
