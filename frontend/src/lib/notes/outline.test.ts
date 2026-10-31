import { describe, expect, it } from 'vitest'
import { Editor, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { extractOutline } from './outline'

const h = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: text ? [{ type: 'text', text }] : undefined,
})
const p = (text?: string) => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text }] : undefined,
})
const doc = (...content: unknown[]) => ({ type: 'doc', content })

describe('extractOutline', () => {
  it('returns headings in order with level and text', () => {
    const out = extractOutline(doc(h(1, 'Intro'), p('body'), h(2, 'Details'), h(3, 'Deep')))
    expect(out.map(({ level, text }) => ({ level, text }))).toEqual([
      { level: 1, text: 'Intro' },
      { level: 2, text: 'Details' },
      { level: 3, text: 'Deep' },
    ])
  })

  it('skips empty headings and non-heading content', () => {
    expect(extractOutline(doc(p('x'), h(2, ''), h(2, '   ')))).toEqual([])
  })

  it('finds headings nested in callouts and toggles', () => {
    const out = extractOutline(
      doc(
        { type: 'callout', content: [h(2, 'In callout')] },
        { type: 'toggle', content: [{ type: 'toggleSummary', content: [] }, h(3, 'In toggle')] }
      )
    )
    expect(out.map(o => o.text)).toEqual(['In callout', 'In toggle'])
  })

  it('does not look inside code blocks', () => {
    expect(
      extractOutline(doc({ type: 'codeBlock', content: [{ type: 'text', text: '# not a heading' }] }))
    ).toEqual([])
  })

  it('uses mention titles and joins marked text', () => {
    const out = extractOutline(
      doc({
        type: 'heading',
        attrs: { level: 2 },
        content: [
          { type: 'text', text: 'See ', marks: [{ type: 'bold' }] },
          { type: 'noteMention', attrs: { noteId: 'n', title: 'Other' } },
        ],
      })
    )
    expect(out[0].text).toBe('See Other')
  })

  it('clamps bad levels to 1', () => {
    expect(extractOutline(doc({ type: 'heading', attrs: { level: 'x' }, content: [{ type: 'text', text: 'T' }] }))[0].level).toBe(1)
  })

  it.each([null, undefined, 3, 'str', {}, { type: 'doc' }, { type: 'doc', content: 'bad' }])(
    'tolerates malformed input %j',
    bad => {
      expect(extractOutline(bad)).toEqual([])
    }
  )

  it('computes positions that match ProseMirror, including after lists, atoms and nesting', () => {
    const content = doc(
      p('first paragraph'),
      h(1, 'One'),
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [p('a'), p('b')] },
          { type: 'listItem', content: [p()] },
        ],
      },
      { type: 'horizontalRule' },
      p(),
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'x' }, { type: 'hardBreak' }, { type: 'text', text: 'y' }],
      },
      { type: 'blockquote', content: [p('quoted'), h(2, 'Quoted heading')] },
      h(2, 'Last')
    )
    const editor = new Editor({ extensions: [StarterKit], content: content as JSONContent })
    const outline = extractOutline(editor.getJSON())
    expect(outline.map(o => o.text)).toEqual(['One', 'Quoted heading', 'Last'])
    for (const entry of outline) {
      const node = editor.state.doc.nodeAt(entry.pos)
      expect(node?.type.name).toBe('heading')
      expect(node?.textContent).toBe(entry.text)
    }
    editor.destroy()
  })
})
