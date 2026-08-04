/**
 * Pure parsers for YouTube's transcript responses.
 *
 * This is where the real complexity of transcript capture lives, so it is kept
 * free of DOM, network and browser globals — everything here is
 * `unknown -> ParseResult` and unit-testable in vitest.
 *
 * Two response shapes are handled:
 *  - InnerTube `/youtubei/v1/get_transcript` (what the transcript panel calls)
 *  - `/api/timedtext` in `fmt=json3` and the legacy XML form
 *
 * Deliberately NOT path-based. YouTube reshapes the wrappers around
 * `initialSegments` regularly, so we search the object graph for
 * `transcriptSegmentRenderer` keys instead of walking a fixed path that would
 * break on the next reshuffle.
 */

export interface TranscriptSegment {
  start: number // seconds
  text: string
}

export type ParseResult =
  | { ok: true; segments: TranscriptSegment[] }
  | { ok: false; reason: string; topLevelKeys: string[] }

/** Bounds. These are part of content, so they must be constants — never
 *  time- or device-dependent, or the same video would hash differently. */
export const MAX_SEGMENTS = 20_000
export const MAX_SEGMENT_CHARS = 2_000
export const MAX_TOTAL_CHARS = 2_000_000

const MAX_DEPTH = 20
const MAX_NODES = 200_000

// --- narrowing helpers -----------------------------------------------------
// Network data is navigated as `unknown`. An interface-shaped cast is how a
// null deep in the tree throws and kills the listener for the whole session.

function asObject(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

function asArray(v: unknown): unknown[] | null {
  return Array.isArray(v) ? v : null
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null
}

/** Accepts "3200" and 3200 alike; anything else is 0 (matches parseTimestamp's
 *  forgiving contract, so both acquisition paths produce identical artifacts). */
function toSeconds(v: unknown): number {
  const n = typeof v === "number" ? v : Number(asString(v) ?? Number.NaN)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n / 1000) : 0
}

function topKeys(v: unknown): string[] {
  const obj = asObject(v)
  return obj ? Object.keys(obj).slice(0, 12) : []
}

// --- normalization ---------------------------------------------------------

/**
 * Canonicalize a segment list: trim, collapse internal whitespace, drop empties,
 * sort by start, dedupe, and clamp to the bounds above.
 *
 * Shared by every acquisition path so the artifact — and therefore the content
 * hash — does not depend on which tier produced it.
 */
export function normalizeSegments(
  input: readonly TranscriptSegment[],
): TranscriptSegment[] {
  const cleaned: TranscriptSegment[] = []
  let total = 0

  for (const seg of input) {
    const text = seg.text.replace(/\s+/g, " ").trim().slice(0, MAX_SEGMENT_CHARS)
    if (text.length === 0) continue
    const start = Number.isFinite(seg.start) && seg.start > 0 ? Math.floor(seg.start) : 0
    total += text.length
    if (total > MAX_TOTAL_CHARS) break
    cleaned.push({ start, text })
    if (cleaned.length >= MAX_SEGMENTS) break
  }

  cleaned.sort((a, b) => a.start - b.start)

  const deduped: TranscriptSegment[] = []
  for (const seg of cleaned) {
    const prev = deduped[deduped.length - 1]
    if (prev && prev.start === seg.start && prev.text === seg.text) continue
    deduped.push(seg)
  }
  return deduped
}

// --- InnerTube get_transcript ---------------------------------------------

function collectRenderers(
  node: unknown,
  out: Record<string, unknown>[],
  depth: number,
  budget: { nodes: number },
): void {
  if (depth > MAX_DEPTH || budget.nodes <= 0 || out.length >= MAX_SEGMENTS) return
  budget.nodes -= 1

  const arr = asArray(node)
  if (arr) {
    for (const item of arr) collectRenderers(item, out, depth + 1, budget)
    return
  }

  const obj = asObject(node)
  if (!obj) return

  for (const [key, value] of Object.entries(obj)) {
    // Chapter headers (transcriptSectionHeaderRenderer) are interleaved with
    // the real segments; not matching them here is how they get skipped.
    if (key === "transcriptSegmentRenderer") {
      const seg = asObject(value)
      if (seg) out.push(seg)
      continue
    }
    collectRenderers(value, out, depth + 1, budget)
  }
}

function textFromSnippet(snippet: unknown): string {
  const obj = asObject(snippet)
  if (!obj) return ""

  const runs = asArray(obj.runs)
  if (runs) {
    return runs
      .map((run) => asString(asObject(run)?.text) ?? "")
      .join("")
  }
  return asString(obj.simpleText) ?? ""
}

/** Parse an InnerTube `get_transcript` response body. */
export function parseInnertubeTranscript(json: unknown): ParseResult {
  if (json === null || json === undefined || json === "") {
    return { ok: false, reason: "empty-input", topLevelKeys: [] }
  }
  if (!asObject(json)) {
    return { ok: false, reason: "not-an-object", topLevelKeys: [] }
  }

  const renderers: Record<string, unknown>[] = []
  collectRenderers(json, renderers, 0, { nodes: MAX_NODES })

  if (renderers.length === 0) {
    const hasActions = asArray(asObject(json)?.actions) !== null
    return {
      ok: false,
      reason: hasActions ? "actions-without-segments" : "no-segment-renderers",
      topLevelKeys: topKeys(json),
    }
  }

  const segments = normalizeSegments(
    renderers.map((r) => ({
      start: toSeconds(r.startMs),
      text: textFromSnippet(r.snippet),
    })),
  )

  if (segments.length === 0) {
    return { ok: false, reason: "all-segments-empty", topLevelKeys: topKeys(json) }
  }
  return { ok: true, segments }
}

// --- timedtext -------------------------------------------------------------

/** Parse `/api/timedtext?fmt=json3`. */
export function parseTimedtextJson3(json: unknown): ParseResult {
  if (json === null || json === undefined || json === "") {
    return { ok: false, reason: "empty-input", topLevelKeys: [] }
  }
  const obj = asObject(json)
  if (!obj) return { ok: false, reason: "not-an-object", topLevelKeys: [] }

  const events = asArray(obj.events)
  if (!events) {
    return { ok: false, reason: "no-events", topLevelKeys: topKeys(json) }
  }

  const raw: TranscriptSegment[] = []
  for (const event of events) {
    const e = asObject(event)
    const segs = asArray(e?.segs)
    if (!e || !segs) continue // spacer events carry no `segs`
    raw.push({
      start: toSeconds(e.tStartMs),
      text: segs.map((s) => asString(asObject(s)?.utf8) ?? "").join(""),
    })
  }

  const segments = normalizeSegments(raw)
  if (segments.length === 0) {
    return { ok: false, reason: "all-segments-empty", topLevelKeys: topKeys(json) }
  }
  return { ok: true, segments }
}

/** Parse the legacy `/api/timedtext` XML form. */
export function parseTimedtextXml(xml: string): ParseResult {
  if (!xml.trim()) return { ok: false, reason: "empty-input", topLevelKeys: [] }

  let doc: Document
  try {
    doc = new DOMParser().parseFromString(xml, "text/xml")
  } catch {
    return { ok: false, reason: "xml-parse-failed", topLevelKeys: [] }
  }
  if (doc.querySelector("parsererror")) {
    return { ok: false, reason: "xml-parse-failed", topLevelKeys: [] }
  }

  const nodes = Array.from(doc.querySelectorAll("text"))
  if (nodes.length === 0) {
    return { ok: false, reason: "no-text-nodes", topLevelKeys: [] }
  }

  // textContent decodes entities for us — a regex table would get it wrong.
  const segments = normalizeSegments(
    nodes.map((el) => ({
      start: toSeconds(Number(el.getAttribute("start") ?? 0) * 1000),
      text: el.textContent ?? "",
    })),
  )

  if (segments.length === 0) {
    return { ok: false, reason: "all-segments-empty", topLevelKeys: [] }
  }
  return { ok: true, segments }
}
