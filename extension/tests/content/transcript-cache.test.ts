import { afterEach, describe, expect, it, vi } from "vitest"

import { createTranscriptCache } from "../../src/content/transcript-cache"
import type { TranscriptSegment } from "../../src/lib/extractors/transcript-parse"
import { YT_BRIDGE_CHANNEL, YT_BRIDGE_VERSION } from "../../src/lib/yt-bridge"

const VIDEO = "dQw4w9WgXcQ"
const OTHER = "abcdefghijk"
const SEGMENTS: TranscriptSegment[] = [{ start: 0, text: "hello" }]

function resultMessage(videoId: string, segments = SEGMENTS): unknown {
  return { ch: YT_BRIDGE_CHANNEL, v: YT_BRIDGE_VERSION, kind: "result", videoId, segments }
}

function failedMessage(videoId: string, reason: string): unknown {
  return { ch: YT_BRIDGE_CHANNEL, v: YT_BRIDGE_VERSION, kind: "failed", videoId, reason }
}

// No global setup file in this repo, so timers are restored per file.
afterEach(() => {
  vi.useRealTimers()
})

describe("transcript cache", () => {
  it("resolves immediately when the transcript is already cached", async () => {
    const cache = createTranscriptCache()
    cache.put(VIDEO, SEGMENTS)

    // Deliberately no timer advance: this must not wait at all.
    await expect(cache.waitFor(VIDEO, 5_000)).resolves.toEqual(SEGMENTS)
  })

  it("resolves a pending wait when the message lands", async () => {
    const cache = createTranscriptCache()
    const pending = cache.waitFor(VIDEO, 5_000)

    cache.handleMessage(resultMessage(VIDEO), true)

    await expect(pending).resolves.toEqual(SEGMENTS)
  })

  it("resolves null on timeout and never rejects", async () => {
    vi.useFakeTimers()
    const cache = createTranscriptCache()
    const pending = cache.waitFor(VIDEO, 2_500)

    await vi.advanceTimersByTimeAsync(2_500)

    await expect(pending).resolves.toBeNull()
  })

  it("keeps the pending entry after a timeout so the next save is instant", async () => {
    vi.useFakeTimers()
    const cache = createTranscriptCache()
    const first = cache.waitFor(VIDEO, 2_500)
    await vi.advanceTimersByTimeAsync(2_500)
    await expect(first).resolves.toBeNull()

    // The slow response finally arrives.
    cache.handleMessage(resultMessage(VIDEO), true)

    await expect(cache.waitFor(VIDEO, 2_500)).resolves.toEqual(SEGMENTS)
  })

  it("does not resolve a waiter with another video's transcript", async () => {
    vi.useFakeTimers()
    const cache = createTranscriptCache()
    const pending = cache.waitFor(VIDEO, 1_000)

    cache.handleMessage(resultMessage(OTHER), true)
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(pending).resolves.toBeNull()
  })

  it("resolves every concurrent waiter exactly once", async () => {
    const cache = createTranscriptCache()
    const a = cache.waitFor(VIDEO, 5_000)
    const b = cache.waitFor(VIDEO, 5_000)

    cache.handleMessage(resultMessage(VIDEO), true)

    await expect(Promise.all([a, b])).resolves.toEqual([SEGMENTS, SEGMENTS])
  })

  it("does not double-resolve when the timer fires after a result", async () => {
    vi.useFakeTimers()
    const cache = createTranscriptCache()
    const pending = cache.waitFor(VIDEO, 1_000)

    cache.handleMessage(resultMessage(VIDEO), true)
    await expect(pending).resolves.toEqual(SEGMENTS)

    // Advancing past the deadline must not disturb the settled entry.
    await vi.advanceTimersByTimeAsync(5_000)
    await expect(cache.waitFor(VIDEO, 1_000)).resolves.toEqual(SEGMENTS)
  })

  it("keeps the first result when a second one races in", async () => {
    const cache = createTranscriptCache()
    cache.handleMessage(resultMessage(VIDEO), true)
    cache.handleMessage(resultMessage(VIDEO, [{ start: 9, text: "later" }]), true)

    await expect(cache.waitFor(VIDEO, 1_000)).resolves.toEqual(SEGMENTS)
  })

  it("treats an authoritative no-captions as an immediate null", async () => {
    const cache = createTranscriptCache()
    cache.handleMessage(failedMessage(VIDEO, "no-captions"), true)

    expect(cache.isSettled(VIDEO)).toBe(true)
    await expect(cache.waitFor(VIDEO, 5_000)).resolves.toBeNull()
  })

  it("does not treat a parse error as no-captions", () => {
    const cache = createTranscriptCache()
    cache.handleMessage(failedMessage(VIDEO, "error"), true)

    // Still pending, so the panel tier gets its chance.
    expect(cache.isSettled(VIDEO)).toBe(false)
  })

  it("drops untrusted and malformed messages", () => {
    const cache = createTranscriptCache()

    cache.handleMessage(resultMessage(VIDEO), false) // wrong origin / frame
    expect(cache.isSettled(VIDEO)).toBe(false)

    const malformed: unknown[] = [
      null,
      "a string",
      {},
      { ch: "other", v: 1, kind: "result", videoId: VIDEO, segments: [] },
      { ch: YT_BRIDGE_CHANNEL, v: 99, kind: "result", videoId: VIDEO, segments: [] },
      { ch: YT_BRIDGE_CHANNEL, v: YT_BRIDGE_VERSION, kind: "result", videoId: "!!", segments: [] },
      { ch: YT_BRIDGE_CHANNEL, v: YT_BRIDGE_VERSION, kind: "result", videoId: VIDEO, segments: "x" },
    ]
    for (const raw of malformed) cache.handleMessage(raw, true)

    expect(cache.isSettled(VIDEO)).toBe(false)
  })

  it("skips segments that are structurally wrong but keeps the good ones", async () => {
    const cache = createTranscriptCache()
    cache.handleMessage(
      resultMessage(VIDEO, [
        { start: 0, text: "kept" },
        { start: Number.NaN, text: "bad start" },
        { text: "no start" },
        { start: 1 },
      ] as TranscriptSegment[]),
      true,
    )

    await expect(cache.waitFor(VIDEO, 1_000)).resolves.toEqual([{ start: 0, text: "kept" }])
  })

  it("evicts the oldest entries and never strands their waiters", async () => {
    const cache = createTranscriptCache(2)
    const stranded = cache.waitFor("aaaaaaaaaaa", 5_000)

    cache.prime("bbbbbbbbbbb")
    cache.prime("ccccccccccc")

    expect(cache.size()).toBe(2)
    await expect(stranded).resolves.toBeNull()
  })
})
