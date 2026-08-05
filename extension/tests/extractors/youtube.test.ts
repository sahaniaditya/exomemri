import { describe, expect, it } from "vitest"

import type { TranscriptSegment, YoutubeArtifact } from "../../src/lib/extractors"
import { extractYouTube, parseTimestamp } from "../../src/lib/extractors"
import { loadFixture } from "./helpers"

const URL = "https://www.youtube.com/watch?v=abc123def45"

describe("parseTimestamp", () => {
  it("parses m:ss and h:mm:ss", () => {
    expect(parseTimestamp("0:00")).toBe(0)
    expect(parseTimestamp("1:05")).toBe(65)
    expect(parseTimestamp("1:02:03")).toBe(3723)
  })

  it("returns 0 on malformed input", () => {
    expect(parseTimestamp("nope")).toBe(0)
  })
})

describe("extractYouTube", () => {
  it("extracts metadata and transcript segments", () => {
    const capture = extractYouTube(loadFixture("youtube-with-transcript.html"), URL)
    expect(capture.type).toBe("youtube")
    expect(capture.title).toBe("Consistent Hashing Explained")
    expect(capture.author).toBe("Systems Channel")
    expect(capture.url).toBe(URL)

    const artifact = JSON.parse(capture.content!) as YoutubeArtifact
    expect(artifact.transcript_available).toBe(true)
    expect(artifact.video_id).toBe("abc123def45")
    expect(artifact.segments).toHaveLength(3)
    expect(artifact.segments[0]).toEqual({
      start: 0,
      text: "Welcome to this talk on consistent hashing.",
    })
    expect(artifact.segments[2]?.start).toBe(3723)
  })

  it("degrades gracefully when the transcript panel is absent", () => {
    const capture = extractYouTube(loadFixture("youtube-no-transcript.html"), URL)
    expect(capture.title).toBe("Some Talk Without a Transcript")
    const artifact = JSON.parse(capture.content!) as YoutubeArtifact
    expect(artifact.transcript_available).toBe(false)
    expect(artifact.segments).toHaveLength(0)
  })

  it("prefers pre-fetched segments over the DOM", () => {
    const segments: TranscriptSegment[] = [{ start: 7, text: "from the collector" }]
    const capture = extractYouTube(loadFixture("youtube-with-transcript.html"), URL, {
      segments,
    })

    const artifact = JSON.parse(capture.content!) as YoutubeArtifact
    expect(artifact.segments).toEqual(segments)
  })

  it("uses pre-fetched segments when the panel was never opened", () => {
    const segments: TranscriptSegment[] = [{ start: 0, text: "intercepted" }]
    const capture = extractYouTube(loadFixture("youtube-no-transcript.html"), URL, {
      segments,
    })

    const artifact = JSON.parse(capture.content!) as YoutubeArtifact
    expect(artifact.transcript_available).toBe(true)
    expect(artifact.segments).toEqual(segments)
  })

  it("falls back to the DOM when the collector returned nothing", () => {
    const capture = extractYouTube(loadFixture("youtube-with-transcript.html"), URL, {
      segments: [],
    })

    const artifact = JSON.parse(capture.content!) as YoutubeArtifact
    expect(artifact.segments).toHaveLength(3)
  })

  it("does not mutate the segments it is given", () => {
    // An in-place sort inside the extractor would corrupt the collector's cache
    // for every later capture of the same video.
    const segments: readonly TranscriptSegment[] = Object.freeze([
      Object.freeze({ start: 9, text: "later" }),
      Object.freeze({ start: 1, text: "earlier" }),
    ])

    expect(() =>
      extractYouTube(loadFixture("youtube-no-transcript.html"), URL, { segments }),
    ).not.toThrow()
    expect(segments[0]).toEqual({ start: 9, text: "later" })
  })

  it("collapses URL variants of the same video onto one identity", () => {
    // The artifact JSON is the backend's dedupe basis, so these must be equal
    // byte for byte or the same video lands as several rows.
    const doc = loadFixture("youtube-no-transcript.html")
    const a = extractYouTube(doc, "https://www.youtube.com/watch?v=abc123def45&t=42s")
    const b = extractYouTube(doc, "https://youtu.be/abc123def45")

    expect(a.content).toBe(b.content)
    expect(a.url).toBe("https://www.youtube.com/watch?v=abc123def45")
  })

  it("serializes artifact fields in a stable order", () => {
    // Reordering the artifact's keys would change every user's content_hash and
    // orphan their existing rows. This makes that trip CI instead.
    const capture = extractYouTube(loadFixture("youtube-with-transcript.html"), URL)
    const artifact = JSON.parse(capture.content!) as YoutubeArtifact

    expect(capture.content).toBe(
      JSON.stringify({
        title: artifact.title,
        url: artifact.url,
        author: artifact.author,
        video_id: artifact.video_id,
        transcript_available: artifact.transcript_available,
        segments: artifact.segments,
      }),
    )
  })
})
