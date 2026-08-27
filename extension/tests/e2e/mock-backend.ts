/**
 * Minimal in-process stand-in for the exomemri capture backend.
 *
 * Runs on http://localhost:8000 (the URL the extension was built with) so the
 * background worker's fetches hit it for real — deterministic and with no
 * Supabase writes. Also serves the article fixture page so the article
 * content script has a real page to run on.
 */
import { readFileSync } from "node:fs"
import { createServer, type Server } from "node:http"
import { resolve } from "node:path"

export interface CapturedRequest {
  path: string
  body: unknown
}

export interface MockBackend {
  server: Server
  requests: CapturedRequest[]
  close: () => Promise<void>
}

const ARTICLE_HTML = readFileSync(
  resolve(process.cwd(), "tests/extractors/fixtures/article.html"),
  "utf-8",
)

export function startMockBackend(port = 8000): Promise<MockBackend> {
  const requests: CapturedRequest[] = []

  const server = createServer((req, res) => {
    const url = req.url ?? "/"
    const chunks: Buffer[] = []
    req.on("data", (c) => chunks.push(c as Buffer))
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8")
      const body = raw ? JSON.parse(raw) : null
      if (req.method !== "GET") requests.push({ path: url, body })

      const json = (status: number, payload: unknown) => {
        res.writeHead(status, { "content-type": "application/json" })
        res.end(JSON.stringify(payload))
      }

      if (url === "/article") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
        res.end(ARTICLE_HTML)
        return
      }
      if (url === "/v1/session") {
        json(200, {
          user: { id: "00000000-0000-0000-0000-0000000000a1", email: "aditya@kimaru.ai" },
          active_space: {
            id: "00000000-0000-0000-0000-0000000000b1",
            name: "System Design",
            slug: "system-design",
          },
        })
        return
      }
      if (url === "/v1/spaces") {
        json(200, {
          spaces: [
            {
              id: "00000000-0000-0000-0000-0000000000b1",
              name: "System Design",
              slug: "system-design",
              goal_text: null,
              created_at: "2026-07-01T00:00:00+00:00",
              last_captured_at: null,
              source_counts: {
                youtube: 0,
                article: 0,
                ai_chat: 0,
                pdf: 0,
                note: 0,
                total: 0,
              },
            },
          ],
        })
        return
      }
      if (url === "/v1/credits") {
        json(200, {
          balance: 100,
          monthly_allowance: 100,
          ask_units: 0,
          period_end: "2026-09-27T00:00:00+00:00",
        })
        return
      }
      if (url === "/v1/sources") {
        json(202, {
          source_id: "11111111-1111-1111-1111-111111111111",
          processing_status: "queued",
        })
        return
      }
      json(404, { error: { code: "not_found", message: url } })
    })
  })

  return new Promise((resolvePromise) => {
    server.listen(port, () => {
      resolvePromise({
        server,
        requests,
        close: () => new Promise<void>((r) => server.close(() => r())),
      })
    })
  })
}
