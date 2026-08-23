/**
 * Capture orchestration in the background worker.
 *
 * Injects the active space id (session state the content script never sees),
 * computes the content hash, and calls the API. For PDFs it obtains a
 * tokenized upload URL and PUTs the bytes directly to Supabase Storage.
 */
import { browser } from "wxt/browser"

import { ApiError, api } from "../lib/api"
import type { CaptureRequest, ExtractedCapture } from "../lib/contracts"
import { contentHash } from "../lib/hash"
import { sendMessage, type CaptureResult, type PdfCaptureInput } from "../lib/messaging"
import { requireActiveSpaceId } from "./session"

/** Turn a backend error into user-facing copy, calling out expired sessions. */
function captureErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 401) {
    return "Session expired — reopen exomemri to refresh."
  }
  return err instanceof Error ? err.message : fallback
}

/**
 * Capture the page in the active tab: ask its content script to extract, then
 * persist. This is what the popup's Save button triggers.
 */
export async function captureActiveTab(): Promise<CaptureResult> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) return { ok: false, error: "No active tab" }

    const extracted = await extractFromTab(tab.id)
    if (extracted === undefined) {
      return { ok: false, error: "Can't capture this page (try a normal web page)." }
    }
    if (extracted === null) return { ok: false, error: "Nothing to capture on this page" }

    return await captureText(extracted)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Capture failed" }
  }
}

/**
 * Ask the tab's content script to extract. If it isn't there yet (tab opened
 * before the extension loaded), inject it once and retry. Returns `undefined`
 * when the page can't host a content script (e.g. chrome:// pages).
 */
async function extractFromTab(tabId: number): Promise<ExtractedCapture | null | undefined> {
  try {
    return await sendMessage("extractCurrentPage", undefined, tabId)
  } catch {
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ["/content-scripts/content.js"],
      })
    } catch {
      return undefined // restricted page — cannot inject
    }
    return await sendMessage("extractCurrentPage", undefined, tabId)
  }
}

export async function captureText(extracted: ExtractedCapture): Promise<CaptureResult> {
  try {
    const spaceId = await requireActiveSpaceId()
    const hash = await contentHash(extracted.content ?? null, extracted.url ?? null)
    const payload: CaptureRequest = { ...extracted, space_id: spaceId, content_hash: hash }
    const resp = await api.captureSource(payload)
    return { ok: true, source_id: resp.source_id }
  } catch (err) {
    return { ok: false, error: captureErrorMessage(err, "Capture failed") }
  }
}

export async function capturePdf(input: PdfCaptureInput): Promise<CaptureResult> {
  try {
    const spaceId = await requireActiveSpaceId()
    const hash = await contentHash(null, input.url)
    const signed = await api.createUploadUrl({
      space_id: spaceId,
      title: input.title,
      url: input.url,
      content_hash: hash,
    })

    const fileResp = await fetch(input.url)
    if (!fileResp.ok) throw new Error(`Could not fetch PDF (${fileResp.status})`)
    const blob = await fileResp.blob()

    const putResp = await fetch(signed.upload_url, {
      method: "PUT",
      headers: { "x-upsert": "true", "content-type": "application/pdf" },
      body: blob,
    })
    if (!putResp.ok) throw new Error(`Upload failed (${putResp.status})`)

    return { ok: true, source_id: signed.source_id }
  } catch (err) {
    return { ok: false, error: captureErrorMessage(err, "PDF capture failed") }
  }
}
