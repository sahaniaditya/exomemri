import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  ASSIST_ERROR_MESSAGE,
  errorKindForStatus,
  requestAssist,
  singleParagraphInline,
  textToParagraphs,
} from './aiAssist'

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status })
}

afterEach(() => vi.unstubAllGlobals())

describe('requestAssist', () => {
  it('posts the payload to the BFF and returns the text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { text: 'done' }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await requestAssist('sp1', {
      action: 'ask',
      text: 'ctx',
      instruction: 'why?',
      noteId: 'n1',
    })
    expect(result).toEqual({ ok: true, text: 'done' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/spaces/sp1/notes/ai')
    expect(JSON.parse(init.body)).toEqual({
      action: 'ask',
      text: 'ctx',
      instruction: 'why?',
      note_id: 'n1',
    })
  })

  it('omits optional fields when absent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { text: 'x' }))
    vi.stubGlobal('fetch', fetchMock)
    await requestAssist('sp1', { action: 'summarize', text: 'ctx' })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      action: 'summarize',
      text: 'ctx',
    })
  })

  it.each([
    [402, 'credits'],
    [429, 'rate'],
    [500, 'server'],
    [404, 'server'],
  ] as const)('maps HTTP %s to %s', async (status, kind) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(status, { error: {} })))
    const result = await requestAssist('sp1', { action: 'rewrite', text: 't' })
    expect(result).toEqual({ ok: false, kind, message: ASSIST_ERROR_MESSAGE[kind] })
    expect(errorKindForStatus(status)).toBe(kind)
  })

  it('reports a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    const result = await requestAssist('sp1', { action: 'rewrite', text: 't' })
    expect(result).toMatchObject({ ok: false, kind: 'network' })
  })

  it('reports an abort distinctly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'))
    )
    const result = await requestAssist('sp1', { action: 'rewrite', text: 't' })
    expect(result).toEqual({ ok: false, kind: 'aborted', message: '' })
  })

  it('treats an empty or malformed 200 as a server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { text: '  ' })))
    expect(await requestAssist('sp1', { action: 'rewrite', text: 't' })).toMatchObject({
      ok: false,
      kind: 'server',
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 200 })))
    expect(await requestAssist('sp1', { action: 'rewrite', text: 't' })).toMatchObject({
      ok: false,
      kind: 'server',
    })
  })
})

describe('textToParagraphs', () => {
  it('splits on blank lines and turns single newlines into hard breaks', () => {
    expect(textToParagraphs('one\ntwo\n\nthree')).toEqual([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'one' },
          { type: 'hardBreak' },
          { type: 'text', text: 'two' },
        ],
      },
      { type: 'paragraph', content: [{ type: 'text', text: 'three' }] },
    ])
  })

  it('returns nothing for blank text', () => {
    expect(textToParagraphs('  \n\n ')).toEqual([])
  })

  it('exposes inline content only for a single paragraph', () => {
    expect(singleParagraphInline('a')).toEqual([{ type: 'text', text: 'a' }])
    expect(singleParagraphInline('a\n\nb')).toBeNull()
  })
})
