import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  EMOJI_PANEL_WIDTH,
  MAX_IMAGE_BYTES,
  collectClipboardImages,
  computeEmojiPanelPosition,
  hydrateImageUrls,
  imageFilename,
  isImageOnlyClipboard,
  isImageOnlyHtml,
  isProbablyUrl,
  isUploadableImage,
} from './editor-utils'

const file = (type: string, size: number, name = 'a.png') =>
  new File([new Uint8Array(size)], name, { type })

function clipboard(parts: Record<string, string>): DataTransfer {
  return { getData: (type: string) => parts[type] ?? '' } as unknown as DataTransfer
}

afterEach(() => vi.unstubAllGlobals())

describe('isUploadableImage', () => {
  it('accepts jpeg/png/webp/gif up to 5 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
      expect(isUploadableImage(file(type, 10))).toBe(true)
    }
    expect(isUploadableImage(file('image/png', MAX_IMAGE_BYTES))).toBe(true)
  })

  it('rejects other types, empty and oversized files', () => {
    expect(isUploadableImage(file('image/svg+xml', 10))).toBe(false)
    expect(isUploadableImage(file('application/pdf', 10))).toBe(false)
    expect(isUploadableImage(file('image/png', 0))).toBe(false)
    expect(isUploadableImage(file('image/png', MAX_IMAGE_BYTES + 1))).toBe(false)
  })
})

describe('clipboard helpers', () => {
  it('isProbablyUrl', () => {
    expect(isProbablyUrl('https://example.com/a')).toBe(true)
    expect(isProbablyUrl('http://x.io')).toBe(true)
    expect(isProbablyUrl('https://example.com two words')).toBe(false)
    expect(isProbablyUrl('example.com')).toBe(false)
  })

  it('isImageOnlyHtml ignores wrapper tags and entities', () => {
    expect(isImageOnlyHtml('<meta charset="utf-8"><img src="x">')).toBe(true)
    expect(isImageOnlyHtml('<html><body><!--StartFragment--><img src="x"><!--End--></body></html>')).toBe(true)
    expect(isImageOnlyHtml('<p>caption</p><img src="x">')).toBe(false)
  })

  it('isImageOnlyClipboard', () => {
    expect(isImageOnlyClipboard(clipboard({}))).toBe(true)
    expect(isImageOnlyClipboard(clipboard({ 'text/plain': 'some words' }))).toBe(false)
    expect(isImageOnlyClipboard(clipboard({ 'text/plain': 'https://x.io/a.png', 'text/html': '<img src="x">' }))).toBe(true)
    expect(isImageOnlyClipboard(clipboard({ 'text/html': '<b>bold</b><img src="x">' }))).toBe(false)
  })

  it('collectClipboardImages prefers items, dedupes, falls back to files', () => {
    const png = file('image/png', 5)
    const item = { kind: 'file', type: 'image/png', getAsFile: () => png }
    const text = { kind: 'string', type: 'text/plain', getAsFile: () => null }
    const withItems = {
      clipboardData: { items: [item, item, text], files: [] },
    } as unknown as ClipboardEvent
    expect(collectClipboardImages(withItems)).toEqual([png])

    const jpg = file('image/jpeg', 5)
    const viaFiles = {
      clipboardData: { items: [text], files: [jpg, file('text/plain', 1)] },
    } as unknown as ClipboardEvent
    expect(collectClipboardImages(viaFiles)).toEqual([jpg])

    expect(collectClipboardImages({ clipboardData: null } as unknown as ClipboardEvent)).toEqual([])
  })

  it('imageFilename names pasted images from their mime type', () => {
    expect(imageFilename(file('image/png', 1, 'shot.png'))).toBe('shot.png')
    expect(imageFilename(file('image/png', 1, '  '))).toBe('pasted-image.png')
    expect(imageFilename(file('image/jpeg', 1, ''))).toBe('pasted-image.jpg')
  })
})

describe('computeEmojiPanelPosition', () => {
  const rect = (left: number, top: number, w = 60, h = 28) =>
    ({ left, top, right: left + w, bottom: top + h, width: w, height: h }) as DOMRect

  it('anchors below the button', () => {
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 800)
    expect(computeEmojiPanelPosition(rect(100, 100), { width: 280, height: 120 })).toEqual({
      top: 134,
      left: 100,
    })
  })

  it('right-aligns when it would overflow the right edge', () => {
    vi.stubGlobal('innerWidth', 400)
    vi.stubGlobal('innerHeight', 800)
    const pos = computeEmojiPanelPosition(rect(300, 100), { width: 280, height: 120 })
    expect(pos.left).toBe(Math.max(8, 360 - 280))
  })

  it('flips above when there is no room below', () => {
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 300)
    const pos = computeEmojiPanelPosition(rect(100, 250), { width: 280, height: 120 })
    expect(pos.top).toBe(250 - 6 - 120)
  })

  it('uses the default width before the panel is measured', () => {
    vi.stubGlobal('innerWidth', 1000)
    vi.stubGlobal('innerHeight', 800)
    const pos = computeEmojiPanelPosition(rect(900, 100), { width: 0, height: 0 })
    expect(pos.left).toBe(Math.max(8, 960 - EMOJI_PANEL_WIDTH))
  })
})

describe('hydrateImageUrls', () => {
  it('adds a signed src to nested image nodes and leaves the input untouched', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) =>
      new Response(JSON.stringify({ url: `signed:${decodeURIComponent(url.split('key=')[1])}` }), {
        status: 200,
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const doc = {
      type: 'doc',
      content: [
        { type: 'image', attrs: { key: 'notes/images/a.png', src: 'old' } },
        { type: 'blockquote', content: [{ type: 'image', attrs: { key: 'notes/images/b.png' } }] },
        { type: 'image', attrs: { src: 'no-key' } },
      ],
    }
    const out = (await hydrateImageUrls(doc, { kind: 'space', spaceId: 's1' })) as typeof doc
    expect(out.content[0].attrs).toMatchObject({ src: 'signed:notes/images/a.png' })
    expect((out.content[1].content as typeof doc.content)[0].attrs).toMatchObject({
      src: 'signed:notes/images/b.png',
    })
    expect(out.content[2].attrs).toEqual({ src: 'no-key' })
    expect((doc.content[0] as { attrs: { src: string } }).attrs.src).toBe('old')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toContain('/api/spaces/s1/note-artifact-url?key=')
  })

  it('keeps the node when the url cannot be resolved', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const doc = { type: 'doc', content: [{ type: 'image', attrs: { key: 'k', src: 'old' } }] }
    const out = (await hydrateImageUrls(doc, { kind: 'source', sourceId: 'x' })) as typeof doc
    expect(out.content[0].attrs.src).toBe('old')
  })
})
