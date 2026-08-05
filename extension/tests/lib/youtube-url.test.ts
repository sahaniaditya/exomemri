import { describe, expect, it } from "vitest"

import { canonicalWatchUrl, videoIdFromUrl } from "../../src/lib/youtube-url"

describe("videoIdFromUrl", () => {
  it("reads the id from every video URL form", () => {
    const cases = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PLabc",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?t=42",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/live/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
    ]
    for (const url of cases) {
      expect(videoIdFromUrl(url), url).toBe("dQw4w9WgXcQ")
    }
  })

  it("returns null for YouTube pages that are not videos", () => {
    const cases = [
      "https://www.youtube.com/",
      "https://www.youtube.com/feed/subscriptions",
      "https://www.youtube.com/@somechannel",
      "https://www.youtube.com/results?search_query=hashing",
      "https://www.youtube.com/playlist?list=PLabc",
      "https://www.youtube.com/watch",
      "https://www.youtube.com/watch?v=",
    ]
    for (const url of cases) {
      expect(videoIdFromUrl(url), url).toBeNull()
    }
  })

  it("returns null for non-YouTube and malformed URLs", () => {
    expect(videoIdFromUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull()
    expect(videoIdFromUrl("https://notyoutube.com/watch?v=dQw4w9WgXcQ")).toBeNull()
    expect(videoIdFromUrl("not a url")).toBeNull()
    expect(videoIdFromUrl("")).toBeNull()
  })

  it("rejects ids that are not plausibly ids", () => {
    expect(videoIdFromUrl("https://www.youtube.com/watch?v=abc")).toBeNull()
    expect(videoIdFromUrl("https://www.youtube.com/watch?v=" + "x".repeat(64))).toBeNull()
    expect(videoIdFromUrl("https://www.youtube.com/watch?v=has%20space")).toBeNull()
  })
})

describe("canonicalWatchUrl", () => {
  it("collapses every variant of one video onto a single URL", () => {
    const variants = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    ]
    const canonical = variants.map((v) => canonicalWatchUrl(videoIdFromUrl(v)!))
    expect(new Set(canonical).size).toBe(1)
    expect(canonical[0]).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
  })
})
