/**
 * Capture orchestration in the background worker.
 *
 * Injects the active space id (session state the content script never sees),
 * computes the content hash, and calls the API. For PDFs it obtains a
 * tokenized upload URL and PUTs the bytes directly to Supabase Storage.
 */
import { api } from "../lib/api"
import type { CaptureRequest } from "../lib/contracts"
import { contentHash } from "../lib/hash"
import type { CaptureResult, PdfCaptureInput } from "../lib/messaging"
import type { ExtractedCapture } from "../lib/contracts"
import { requireActiveSpaceId } from "./session"

export async function captureText(extracted: ExtractedCapture): Promise<CaptureResult> {
  try {
    const spaceId = await requireActiveSpaceId()
    const hash = await contentHash(extracted.content ?? null, extracted.url ?? null)
    const payload: CaptureRequest = { ...extracted, space_id: spaceId, content_hash: hash }
    const resp = await api.captureSource(payload)
    return { ok: true, source_id: resp.source_id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Capture failed" }
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
    return { ok: false, error: err instanceof Error ? err.message : "PDF capture failed" }
  }
}
