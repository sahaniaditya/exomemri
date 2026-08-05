import { describe, expect, it, vi } from "vitest"

import {
  isTranscriptUrl,
  wrapFetch,
  type TranscriptCapture,
} from "../../src/lib/youtube-fetch-hook"

const TRANSCRIPT = "https://www.youtube.com/youtubei/v1/get_transcript?key=x"
const TIMEDTEXT = "https://www.youtube.com/api/timedtext?v=abc123&fmt=json3"
const OTHER = "https://www.youtube.com/youtubei/v1/player"

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  })
}

/** Let the detached body-read promise chain settle. */
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe("isTranscriptUrl", () => {
  it("matches transcript endpoints only", () => {
    expect(isTranscriptUrl(TRANSCRIPT)).toBe(true)
    expect(isTranscriptUrl(TIMEDTEXT)).toBe(true)
    expect(isTranscriptUrl(OTHER)).toBe(false)
  })
})

describe("wrapFetch", () => {
  it("leaves the caller's response body readable", async () => {
    // The single most important assertion here: if the tap consumed the body
    // instead of cloning it, YouTube's own code would read a drained stream and
    // the page would break.
    const original = vi.fn(async () => jsonResponse({ hello: "world" }))
    const patched = wrapFetch(original, () => {})

    const res = await patched(TRANSCRIPT)
    await expect(res.json()).resolves.toEqual({ hello: "world" })
  })

  it("delivers the body to the handler", async () => {
    const seen: TranscriptCapture[] = []
    const patched = wrapFetch(async () => jsonResponse({ a: 1 }), (c) => seen.push(c))

    await patched(TRANSCRIPT)
    await flush()

    expect(seen).toHaveLength(1)
    expect(seen[0]?.url).toBe(TRANSCRIPT)
    expect(seen[0]?.body).toBe('{"a":1}')
  })

  it("tags the capture with the video id at request time, not response time", async () => {
    let current = "video-A"
    const patched = wrapFetch(
      async () => {
        current = "video-B" // user navigates while the request is in flight
        return jsonResponse({})
      },
      (c) => {
        expect(c.tag).toBe("video-A")
      },
      () => current,
    )

    await patched(TRANSCRIPT)
    await flush()
  })

  it("ignores non-transcript requests entirely", async () => {
    const onPayload = vi.fn()
    const patched = wrapFetch(async () => jsonResponse({}), onPayload)

    await patched(OTHER)
    await flush()

    expect(onPayload).not.toHaveBeenCalled()
  })

  it("matches Request-object arguments, not just strings", async () => {
    const onPayload = vi.fn()
    const patched = wrapFetch(async () => jsonResponse({}), onPayload)

    await patched(new Request(TIMEDTEXT))
    await flush()

    expect(onPayload).toHaveBeenCalledOnce()
  })

  it("does not reject the caller when the handler throws", async () => {
    const patched = wrapFetch(async () => jsonResponse({}), () => {
      throw new Error("handler blew up")
    })

    await expect(patched(TRANSCRIPT)).resolves.toBeInstanceOf(Response)
    await flush()
  })

  it("propagates the original rejection unchanged", async () => {
    const boom = new Error("network down")
    const patched = wrapFetch(() => Promise.reject(boom), () => {})

    await expect(patched(TRANSCRIPT)).rejects.toBe(boom)
  })

  it("passes init through and preserves the original's arguments", async () => {
    const original = vi.fn(async () => jsonResponse({}))
    const patched = wrapFetch(original, () => {})
    const init: RequestInit = { method: "POST", body: "{}" }

    await patched(TRANSCRIPT, init)

    expect(original).toHaveBeenCalledWith(TRANSCRIPT, init)
  })
})
