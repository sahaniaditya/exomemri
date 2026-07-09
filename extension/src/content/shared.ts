/**
 * Content-script side of the message contract.
 *
 * Content scripts import ONLY this (never src/background/*), so no session or
 * network code is ever bundled into the page's world.
 */
import type { ExtractedCapture, Space } from "../lib/contracts"
import { sendMessage, type CaptureResult, type PdfCaptureInput } from "../lib/messaging"

export const sendCapture = (payload: ExtractedCapture): Promise<CaptureResult> =>
  sendMessage("capture", payload)

export const sendCapturePdf = (payload: PdfCaptureInput): Promise<CaptureResult> =>
  sendMessage("capturePdf", payload)

export const getActiveSpace = (): Promise<Space | null> => sendMessage("getActiveSpace", undefined)
