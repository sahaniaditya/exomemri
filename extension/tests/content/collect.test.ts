import { describe, expect, it, vi } from "vitest"

import { detectAndExtractAsync } from "../../src/content/detect"
import type { YoutubeArtifact } from "../../src/lib/extractors"
import type { TranscriptSegment } from "../../src/lib/extractors/transcript-parse"
import { loadFixture } from "../extractors/helpers"

const WATCH = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
const FETCHED: TranscriptSegment[] = [{ start: 5, text: "from the collector" }]

describe("detectAndExtractAsync", () => {
  it("asks the collector for the transcript and puts it in the artifact", async () => {
    const getTranscript = vi.fn(async () => FETCHED)
    const capture = await detectAndExtractAsync(
      loadFixture("youtube-no-transcript.html"),
      WATCH,
      getTranscript,
    )

    expect(getTranscript).toHaveBeenCalledExactlyOnceWith("dQw4w9WgXcQ")
    const artifact = JSON.parse(capture!.content!) as YoutubeArtifact
    expect(artifact.transcript_available).toBe(true)
    expect(artifact.segments).toEqual(FETCHED)
  })

  it("does not touch the collector for non-YouTube pages", async () => {
    const getTranscript = vi.fn(async () => FETCHED)
    await detectAndExtractAsync(
      loadFixture("article.html"),
      "https://example.com/post",
      getTranscript,
    )

    // An eager await on every article page would be a real latency regression.
    expect(getTranscript).not.toHaveBeenCalled()
  })

  it("does not treat non-video YouTube pages as videos", async () => {
    const getTranscript = vi.fn(async () => FETCHED)
    const capture = await detectAndExtractAsync(
      loadFixture("article.html"),
      "https://www.youtube.com/feed/subscriptions",
      getTranscript,
    )

    expect(getTranscript).not.toHaveBeenCalled()
    expect(capture?.type).not.toBe("youtube")
  })

  it("still captures when the transcript lookup fails", async () => {
    const capture = await detectAndExtractAsync(
      loadFixture("youtube-no-transcript.html"),
      WATCH,
      async () => {
        throw new Error("collector exploded")
      },
    )

    expect(capture?.type).toBe("youtube")
    const artifact = JSON.parse(capture!.content!) as YoutubeArtifact
    expect(artifact.transcript_available).toBe(false)
  })

  it("falls back to the open panel when the collector has nothing", async () => {
    const capture = await detectAndExtractAsync(
      loadFixture("youtube-with-transcript.html"),
      WATCH,
      async () => null,
    )

    const artifact = JSON.parse(capture!.content!) as YoutubeArtifact
    expect(artifact.segments).toHaveLength(3)
  })

  it("returns null for a malformed URL", async () => {
    await expect(
      detectAndExtractAsync(loadFixture("article.html"), "not a url", async () => null),
    ).resolves.toBeNull()
  })
})
