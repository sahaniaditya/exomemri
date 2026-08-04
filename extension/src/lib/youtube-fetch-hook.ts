/**
 * Transparent taps over `fetch` and `XMLHttpRequest`.
 *
 * These run in the page's MAIN world on youtube.com, so a bug here does not
 * merely lose a transcript — it breaks YouTube for the user. Every function is
 * written to that standard:
 *
 *   - the caller always gets the ORIGINAL response object back, unread;
 *   - bodies are inspected via `clone()` in a detached promise that is never
 *     awaited in the caller's path;
 *   - nothing thrown by the payload handler can reach the caller;
 *   - non-transcript requests take a single regex test and nothing else.
 *
 * The `tag` is captured synchronously when the request is ISSUED, not when it
 * resolves. On a single-page navigation between videos those two moments can
 * straddle the switch, and attributing video A's transcript to video B is the
 * worst failure this feature can produce — silent, plausible, permanently wrong.
 *
 * Kept out of the entrypoint (which has module-scope side effects) so it can be
 * unit-tested with a fake `fetch`.
 */

export interface TranscriptCapture {
  url: string
  body: string
  /** Whatever the tagger returned when the request was issued. */
  tag: string | null
}

export type TranscriptPayload = (capture: TranscriptCapture) => void
export type RequestTagger = () => string | null

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const TRANSCRIPT_URL = /\/youtubei\/v1\/get_transcript|\/api\/timedtext/

export function isTranscriptUrl(url: string): boolean {
  return TRANSCRIPT_URL.test(url)
}

function urlOf(input: RequestInfo | URL): string | null {
  if (typeof input === "string") return input
  if (typeof URL !== "undefined" && input instanceof URL) return input.href
  if (typeof Request !== "undefined" && input instanceof Request) return input.url
  return null
}

function deliver(onPayload: TranscriptPayload, capture: TranscriptCapture): void {
  try {
    onPayload(capture)
  } catch {
    // A failing handler must never surface to the page.
  }
}

function tagOf(tagger: RequestTagger | undefined): string | null {
  if (!tagger) return null
  try {
    return tagger()
  } catch {
    // A failing tagger just means an untagged capture.
    return null
  }
}

/** Wrap a fetch implementation so transcript responses are observed in passing. */
export function wrapFetch(
  original: FetchLike,
  onPayload: TranscriptPayload,
  tagger?: RequestTagger,
): FetchLike {
  return function patchedFetch(
    this: unknown,
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    let watch: { url: string; tag: string | null } | null = null
    try {
      const url = urlOf(input)
      if (url !== null && isTranscriptUrl(url)) {
        watch = { url, tag: tagOf(tagger) }
      }
    } catch {
      // Never let instrumentation break the request.
    }

    const promise = original.call(this, input, init)
    if (watch === null) return promise

    const { url, tag } = watch
    void promise
      .then((res) => {
        // clone() so the page's own read of the body is untouched.
        res
          .clone()
          .text()
          .then((body) => deliver(onPayload, { url, body, tag }))
          .catch(() => {
            // Body already consumed or not text — nothing to observe.
          })
      })
      .catch(() => {
        // The caller sees this rejection; we must not double-handle it.
      })

    return promise
  }
}

/**
 * Patch `XMLHttpRequest.prototype.open` to observe transcript responses.
 * Returns a function that restores the original.
 */
export function installXhrTap(
  xhr: typeof XMLHttpRequest,
  onPayload: TranscriptPayload,
  tagger?: RequestTagger,
): () => void {
  const original = xhr.prototype.open
  type OpenArgs = [method: string, url: string | URL, ...rest: unknown[]]

  function patchedOpen(this: XMLHttpRequest, ...args: OpenArgs): void {
    try {
      const raw = args[1]
      const url = typeof raw === "string" ? raw : raw.href
      if (isTranscriptUrl(url)) {
        const tag = tagOf(tagger)
        this.addEventListener(
          "loadend",
          () => {
            try {
              if (this.status >= 200 && this.status < 300) {
                const body = this.responseText
                if (typeof body === "string" && body.length > 0) {
                  deliver(onPayload, { url, body, tag })
                }
              }
            } catch {
              // responseText throws for non-text responseTypes.
            }
          },
          { capture: true, once: true },
        )
      }
    } catch {
      // Never let instrumentation break the request.
    }

    const call = original as unknown as (this: XMLHttpRequest, ...a: OpenArgs) => void
    return call.apply(this, args)
  }

  xhr.prototype.open = patchedOpen as typeof original
  return () => {
    xhr.prototype.open = original
  }
}
