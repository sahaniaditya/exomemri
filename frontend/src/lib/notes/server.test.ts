import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiFetch = vi.fn()
vi.mock('@/lib/api', () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }))

import { loadNoteTree } from './server'

beforeEach(() => {
  apiFetch.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('loadNoteTree', () => {
  it('returns the items from the backend using the token', async () => {
    apiFetch.mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: 'a' }] })))
    expect(await loadNoteTree('tok', 's1')).toEqual({ items: [{ id: 'a' }], error: false })
    expect(apiFetch).toHaveBeenCalledWith('/v1/spaces/s1/notes/tree', {}, 'tok')
  })

  it('flags an error (not just an empty tree) on a non-OK status', async () => {
    apiFetch.mockResolvedValueOnce(new Response('{}', { status: 500 }))
    expect(await loadNoteTree('tok', 's1')).toEqual({ items: [], error: true })
  })

  it('flags an error when the request throws', async () => {
    apiFetch.mockRejectedValueOnce(new Error('offline'))
    expect(await loadNoteTree('tok', 's1')).toEqual({ items: [], error: true })
  })

  it('tolerates a body without items', async () => {
    apiFetch.mockResolvedValueOnce(new Response('{}'))
    expect(await loadNoteTree('tok', 's1')).toEqual({ items: [], error: false })
  })
})
