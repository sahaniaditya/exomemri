import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { buildNoteExtensions } from '../extensions'

const scope = { kind: 'space' as const, spaceId: 's1' }
const editors: Editor[] = []

function makeEditor(content?: Record<string, unknown>): Editor {
  const editor = new Editor({
    extensions: buildNoteExtensions(scope),
    content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
  })
  editors.push(editor)
  return editor
}

/** Simulates typing text at the cursor so ProseMirror input rules run. */
function type(editor: Editor, text: string): void {
  for (const char of text) {
    const { from, to } = editor.state.selection
    const handled = editor.view.someProp('handleTextInput', f =>
      f(editor.view, from, to, char, () => editor.state.tr.insertText(char, from, to))
    )
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(char, from, to))
  }
}

afterEach(() => {
  while (editors.length) editors.pop()?.destroy()
})

describe('buildNoteExtensions', () => {
  it('registers every extension name exactly once', () => {
    const editor = makeEditor()
    const names = editor.extensionManager.extensions.map(ext => ext.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toEqual(
      expect.arrayContaining(['heading', 'codeBlock', 'link', 'image', 'slash'])
    )
  })

  it.each([
    ['# ', 1],
    ['## ', 2],
    ['### ', 3],
  ])('typing "%s" creates a heading of the matching level', (typed, level) => {
    const editor = makeEditor()
    type(editor, `${typed}Title`)
    const first = editor.getJSON().content?.[0]
    expect(first?.type).toBe('heading')
    expect(first?.attrs?.level).toBe(level)
    expect((first?.content?.[0] as { text?: string }).text).toBe('Title')
  })

  it('does not create a level 4 heading', () => {
    const editor = makeEditor()
    type(editor, '#### x')
    expect(editor.getJSON().content?.[0].type).toBe('paragraph')
  })

  it.each([
    ['- ', 'bulletList'],
    ['1. ', 'orderedList'],
    ['> ', 'blockquote'],
    ['``` ', 'codeBlock'],
  ])('markdown shortcut "%s" creates %s', (typed, nodeType) => {
    const editor = makeEditor()
    type(editor, typed)
    expect(editor.getJSON().content?.[0].type).toBe(nodeType)
  })

  it('converts --- into a horizontal rule', () => {
    const editor = makeEditor()
    type(editor, '---')
    expect(editor.getJSON().content?.some(node => node.type === 'horizontalRule')).toBe(true)
  })

  it('loads a legacy document and round-trips it unchanged', () => {
    const legacy = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'See ' },
            {
              type: 'text',
              text: 'the docs',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://example.com',
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    class: null,
                    title: null,
                  },
                },
              ],
            },
          ],
        },
        {
          type: 'codeBlock',
          attrs: { language: null },
          content: [{ type: 'text', text: 'const a = 1' }],
        },
        {
          type: 'image',
          attrs: {
            src: 'https://cdn.example.com/x.png',
            alt: 'pasted-image.png',
            title: null,
            width: null,
            height: null,
            key: 'notes/images/abc.png',
          },
        },
        { type: 'paragraph' },
      ],
    }
    const editor = makeEditor(legacy)
    expect(editor.getJSON()).toEqual(legacy)
  })
})
