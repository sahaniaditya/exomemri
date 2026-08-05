import { describe, expect, it } from "vitest"

import {
  MAX_SEGMENTS,
  normalizeSegments,
  parseInnertubeTranscript,
  parseTimedtextJson3,
  parseTimedtextXml,
} from "../../src/lib/extractors/transcript-parse"
import { loadJsonFixture } from "../extractors/helpers"

describe("parseInnertubeTranscript", () => {
  it("parses the documented response shape", () => {
    const result = parseInnertubeTranscript(loadJsonFixture("innertube-get-transcript.json"))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.segments).toEqual([
      { start: 0, text: "Welcome to this talk on consistent hashing." },
      { start: 65, text: "The ring is the key idea." },
      { start: 3723, text: "Thanks for watching." },
    ])
  })

  it("concatenates multiple runs, collapses whitespace and drops empty segments", () => {
    // All three behaviours are exercised by the fixture above: runs joined into
    // one sentence, the triple-spaced snippet collapsed, and the whitespace-only
    // segment at 1:10 removed entirely.
    const result = parseInnertubeTranscript(loadJsonFixture("innertube-get-transcript.json"))
    if (!result.ok) throw new Error("expected ok")
    expect(result.segments).toHaveLength(3)
    expect(result.segments.some((s) => s.start === 70)).toBe(false)
  })

  it("skips chapter headers rather than emitting them as segments", () => {
    const result = parseInnertubeTranscript(loadJsonFixture("innertube-get-transcript.json"))
    if (!result.ok) throw new Error("expected ok")
    expect(result.segments.some((s) => s.text === "Introduction")).toBe(false)
  })

  it("finds segments regardless of how deeply they are wrapped", () => {
    // The whole point of searching rather than walking a fixed path: YouTube
    // reshuffles these wrappers and the parser should not care.
    const nested = {
      some: { unexpected: { wrapper: [{ transcriptSegmentRenderer: {
        startMs: "1000",
        snippet: { runs: [{ text: "still found" }] },
      } }] } },
    }
    const result = parseInnertubeTranscript(nested)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.segments).toEqual([{ start: 1, text: "still found" }])
  })

  it("uses simpleText when there are no runs", () => {
    const result = parseInnertubeTranscript({
      transcriptSegmentRenderer: { startMs: "2000", snippet: { simpleText: "plain" } },
    })
    if (!result.ok) throw new Error("expected ok")
    expect(result.segments).toEqual([{ start: 2, text: "plain" }])
  })

  it("treats a missing or non-numeric startMs as 0", () => {
    const result = parseInnertubeTranscript({
      transcriptSegmentRenderer: { snippet: { simpleText: "no start" } },
    })
    if (!result.ok) throw new Error("expected ok")
    expect(result.segments[0]?.start).toBe(0)
  })

  it("never throws on malformed input, and reports a distinct reason per level", () => {
    const cases: Array<[unknown, string]> = [
      [null, "empty-input"],
      [undefined, "empty-input"],
      ["", "empty-input"],
      [0, "not-an-object"],
      ["nonsense", "not-an-object"],
      [[], "not-an-object"],
      [{}, "no-segment-renderers"],
      [{ actions: null }, "no-segment-renderers"],
      [{ actions: [{}] }, "actions-without-segments"],
      [{ actions: [{ transcriptSegmentRenderer: { snippet: {} } }] }, "all-segments-empty"],
    ]

    for (const [input, reason] of cases) {
      const result = parseInnertubeTranscript(input)
      expect(result.ok, JSON.stringify(input)).toBe(false)
      if (!result.ok) expect(result.reason, JSON.stringify(input)).toBe(reason)
    }
  })

  it("reports top-level keys so drift is diagnosable", () => {
    const result = parseInnertubeTranscript({ responseContext: {}, somethingNew: {} })
    if (result.ok) throw new Error("expected failure")
    expect(result.topLevelKeys).toEqual(["responseContext", "somethingNew"])
  })
})

describe("parseTimedtextJson3", () => {
  it("parses events into segments", () => {
    const result = parseTimedtextJson3({
      events: [
        { tStartMs: 0, dDurationMs: 3000, segs: [{ utf8: "hello " }, { utf8: "world" }] },
        { tStartMs: 5000, dDurationMs: 1000, segs: [{ utf8: "again" }] },
      ],
    })
    if (!result.ok) throw new Error("expected ok")
    expect(result.segments).toEqual([
      { start: 0, text: "hello world" },
      { start: 5, text: "again" },
    ])
  })

  it("skips spacer events that carry no segs", () => {
    const result = parseTimedtextJson3({
      events: [{ tStartMs: 0, dDurationMs: 100 }, { tStartMs: 1000, segs: [{ utf8: "x" }] }],
    })
    if (!result.ok) throw new Error("expected ok")
    expect(result.segments).toHaveLength(1)
  })

  it("fails cleanly without events", () => {
    expect(parseTimedtextJson3({}).ok).toBe(false)
    expect(parseTimedtextJson3(null).ok).toBe(false)
  })
})

describe("parseTimedtextXml", () => {
  it("parses the legacy XML form and decodes entities", () => {
    const xml =
      '<?xml version="1.0" encoding="utf-8"?><transcript>' +
      '<text start="0" dur="3.2">Tom &amp; Jerry</text>' +
      '<text start="12.5" dur="2">second &lt;line&gt;</text>' +
      "</transcript>"
    const result = parseTimedtextXml(xml)
    if (!result.ok) throw new Error("expected ok")
    expect(result.segments).toEqual([
      { start: 0, text: "Tom & Jerry" },
      { start: 12, text: "second <line>" },
    ])
  })

  it("fails cleanly on empty or non-transcript XML", () => {
    expect(parseTimedtextXml("").ok).toBe(false)
    expect(parseTimedtextXml("<other/>").ok).toBe(false)
  })
})

describe("normalizeSegments", () => {
  it("sorts by start and drops exact duplicates", () => {
    expect(
      normalizeSegments([
        { start: 10, text: "b" },
        { start: 0, text: "a" },
        { start: 10, text: "b" },
      ]),
    ).toEqual([
      { start: 0, text: "a" },
      { start: 10, text: "b" },
    ])
  })

  it("truncates deterministically at the segment cap", () => {
    const many = Array.from({ length: MAX_SEGMENTS + 500 }, (_, i) => ({
      start: i,
      text: `line ${i}`,
    }))
    const out = normalizeSegments(many)
    expect(out).toHaveLength(MAX_SEGMENTS)
    expect(out[0]).toEqual({ start: 0, text: "line 0" })
  })
})
