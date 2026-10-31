/** Test helpers shared by the notes component tests (not shipped). */
import { vi } from 'vitest'
import type { NoteTreeItem } from '@/lib/notes/types'

export type Handler = (call: { url: string; method: string; body: unknown }) => Response | Promise<Response>

export const jsonResponse = (status: number, body?: unknown): Response =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
  })

export interface RecordedCall {
  url: string
  method: string
  body: unknown
}

/**
 * Stub `fetch` with a routing function. Returns the recorded calls so tests
 * can assert on exactly what the UI sent. Unrouted requests fail the test.
 */
export function stubFetch(route: Handler) {
  const calls: RecordedCall[] = []
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = (init?.method ?? 'GET').toUpperCase()
    let body: unknown = undefined
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body)
      } catch {
        body = init.body
      }
    } else if (init?.body) {
      body = init.body
    }
    calls.push({ url, method, body })
    return route({ url, method, body })
  })
  vi.stubGlobal('fetch', fn)
  return { calls, fn }
}

export const item = (
  id: string,
  order = 0,
  parent: string | null = null,
  title = id.toUpperCase(),
  icon: string | null = null
): NoteTreeItem => ({ id, title, icon, parent_id: parent, sort_order: order, updated_at: null })

export const pageFor = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  space_id: 's1',
  title: id.toUpperCase(),
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
  icon: null,
  cover_key: null,
  full_width: false,
  parent_id: null,
  sort_order: 0,
  created_at: null,
  updated_at: '2026-01-01T00:00:00+00:00',
  ...extra,
})
