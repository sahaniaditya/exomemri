import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import '@/test/layoutStubs'
import { createEditor, doc, getDoc, p } from '@/test/noteEditor'
import SelectionMenu, { shouldShowSelectionMenu } from './SelectionMenu'

let editor: Editor
afterEach(() => {
  cleanup()
  editor?.destroy()
})

function select(from: number, to: number) {
  act(() => {
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to)),
    )
  })
}

function setup(content = doc(p('hello world'), { type: 'codeBlock', content: [{ type: 'text', text: 'let x = 1' }] })) {
  editor = createEditor(content)
  render(<SelectionMenu editor={editor} />)
}

/** Select a range and wait for the BubbleMenu plugin to mount the toolbar. */
async function open(from: number, to: number) {
  select(from, to)
  return screen.findByTestId('selection-menu', {}, { timeout: 2000 })
}

/** The BubbleMenu plugin mounts/unmounts its element in the page; its inline style hides it. */
const isShown = (menu: HTMLElement) => {
  const wrapper = menu.parentElement as HTMLElement
  return (
    menu.isConnected && wrapper.style.visibility !== 'hidden' && wrapper.style.display !== 'none'
  )
}

describe('shouldShowSelectionMenu', () => {
  const call = () => shouldShowSelectionMenu({ editor, state: editor.state })

  it('is false for a collapsed cursor and true for a text range', () => {
    editor = createEditor(doc(p('hello world')))
    select(2, 2)
    expect(call()).toBe(false)
    select(1, 6)
    expect(call()).toBe(true)
  })

  it('is false inside a code block, even with a range selected', () => {
    editor = createEditor(doc(p('para'), { type: 'codeBlock', content: [{ type: 'text', text: 'let x = 1' }] }))
    select(8, 11)
    expect(editor.state.selection.$from.parent.type.name).toBe('codeBlock')
    expect(call()).toBe(false)
  })

  it('is false when the selection straddles into a code block', () => {
    editor = createEditor(doc(p('para'), { type: 'codeBlock', content: [{ type: 'text', text: 'let x = 1' }] }))
    select(2, 10)
    expect(call()).toBe(false)
  })

  it('is false when the editor is read-only', () => {
    editor = createEditor(doc(p('hello world')))
    select(1, 6)
    editor.setEditable(false)
    expect(call()).toBe(false)
  })
})

describe('SelectionMenu', () => {
  it('shows the toolbar on a text selection and hides it when collapsed', async () => {
    setup()
    const menu = await open(1, 6)
    await waitFor(() => expect(isShown(menu)).toBe(true))
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument()
    select(3, 3)
    await waitFor(() => expect(isShown(menu)).toBe(false))
  })

  it('is never shown for a selection inside a code block', async () => {
    setup()
    select(15, 18)
    expect(editor.state.selection.$from.parent.type.name).toBe('codeBlock')
    await new Promise((r) => setTimeout(r, 600))
    const menu = screen.queryByTestId('selection-menu')
    expect(menu === null || !isShown(menu)).toBe(true)
  })

  it('applies and reflects bold, italic, strike and code', async () => {
    setup()
    await open(1, 6)
    for (const [label, mark] of [
      ['Bold', 'bold'],
      ['Italic', 'italic'],
      ['Strikethrough', 'strike'],
      ['Code', 'code'],
    ] as const) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(editor.isActive(mark)).toBe(true)
      expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true')
    }
  })

  describe('link input', () => {
    const openLink = async () => {
      await open(1, 6)
      fireEvent.click(screen.getByRole('button', { name: 'Link' }))
      return screen.getByLabelText('Link URL') as HTMLInputElement
    }
    const submit = (input: HTMLInputElement, value: string) => {
      fireEvent.change(input, { target: { value } })
      fireEvent.submit(input.closest('form')!)
    }
    const linkHref = () => {
      const first = getDoc(editor).content![0].content![0]
      return first.marks?.find((m) => m.type === 'link')?.attrs?.href as string | undefined
    }

    it('accepts an https link without using window.prompt', async () => {
      setup()
      const prompt = window.prompt
      window.prompt = () => {
        throw new Error('window.prompt must not be used')
      }
      try {
        const input = await openLink()
        submit(input, 'https://example.com/a')
        expect(linkHref()).toBe('https://example.com/a')
        expect(screen.queryByLabelText('Link URL')).not.toBeInTheDocument()
      } finally {
        window.prompt = prompt
      }
    })

    it('accepts mailto links', async () => {
      setup()
      submit(await openLink(), 'mailto:me@example.com')
      expect(linkHref()).toBe('mailto:me@example.com')
    })

    it.each(['javascript:alert(1)', 'data:text/html,hi', 'ftp://example.com'])(
      'rejects %s and shows an error',
      async (bad) => {
        setup()
        const input = await openLink()
        submit(input, bad)
        expect(linkHref()).toBeUndefined()
        expect(screen.getByRole('alert')).toHaveTextContent(/only http|valid link/i)
        expect(input).toHaveAttribute('aria-invalid', 'true')
      },
    )

    it('removes the link when the field is emptied', async () => {
      setup()
      submit(await openLink(), 'https://example.com')
      expect(linkHref()).toBe('https://example.com')
      await open(1, 6)
      const input = screen.getByRole('button', { name: 'Link' }) && (() => {
        fireEvent.click(screen.getByRole('button', { name: 'Link' }))
        return screen.getByLabelText('Link URL') as HTMLInputElement
      })()
      expect(input.value).toBe('https://example.com')
      submit(input, '')
      expect(linkHref()).toBeUndefined()
    })

    it('Escape closes the input without changes', async () => {
      setup()
      const input = await openLink()
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(screen.queryByLabelText('Link URL')).not.toBeInTheDocument()
      expect(linkHref()).toBeUndefined()
    })
  })

  it('applies a highlight and a text colour from the palette and clears them', async () => {
    setup()
    await open(1, 6)
    fireEvent.click(screen.getByRole('button', { name: 'Highlight' }))
    expect(screen.getAllByRole('button', { name: /^Highlight: / })).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'Highlight: Yellow' }))
    expect(editor.isActive('highlight', { color: 'var(--note-hl-yellow)' })).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
    expect(screen.getAllByRole('button', { name: /^Text color: / })).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'Text color: Red' }))
    expect(editor.getAttributes('textStyle').color).toBe('var(--note-text-red)')

    fireEvent.click(screen.getByRole('button', { name: 'Highlight' }))
    fireEvent.click(screen.getByRole('button', { name: /Clear highlight/i }))
    expect(editor.isActive('highlight')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Text color' }))
    fireEvent.click(screen.getByRole('button', { name: /Clear text color/i }))
    expect(editor.getAttributes('textStyle').color ?? null).toBeNull()
  })

  it.each([
    ['Heading 2', 'heading'],
    ['Quote', 'blockquote'],
    ['Bulleted list', 'bulletList'],
    ['Numbered list', 'orderedList'],
    ['To-do list', 'taskList'],
    ['Callout', 'callout'],
    ['Toggle', 'toggle'],
  ])('Turn into %s converts the block', async (label, nodeType) => {
    setup(doc(p('hello world'), p('other')))
    await open(1, 6)
    fireEvent.click(screen.getByRole('button', { name: 'Turn into' }))
    fireEvent.click(screen.getByRole('menuitem', { name: new RegExp(label) }))
    const blocks = getDoc(editor).content!
    expect(blocks[0].type).toBe(nodeType)
    expect(blocks[blocks.length - 1].content?.[0]?.text ?? blocks[blocks.length - 1].type).toBeTruthy()
    expect(editor.state.doc.textContent).toContain('hello world')
    expect(editor.state.doc.textContent).toContain('other')
  })

  it('Turn into offers headings, quote, lists, task, callout and toggle but not code', async () => {
    setup()
    await open(1, 6)
    fireEvent.click(screen.getByRole('button', { name: 'Turn into' }))
    const names = screen.getAllByRole('menuitem').map((el) => el.textContent)
    for (const n of ['Text', 'Heading 1', 'Heading 2', 'Heading 3', 'Quote', 'Bulleted list', 'Numbered list', 'To-do list', 'Callout', 'Toggle']) {
      expect(names.some((t) => t?.includes(n))).toBe(true)
    }
    expect(names.some((t) => t?.includes('Code'))).toBe(false)
  })

  it('renders nothing without an editor', () => {
    const { container } = render(<SelectionMenu editor={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
