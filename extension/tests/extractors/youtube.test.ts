import { describe, expect, it } from "vitest"

import type { YoutubeArtifact } from "../../src/lib/extractors"
import { extractYouTube, parseTimestamp } from "../../src/lib/extractors"
import { loadFixture } from "./helpers"

const URL = "https://www.youtube.com/watch?v=abc123"

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
    expect(artifact.duration).toBe("12:34")
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
})
