import { Node, mergeAttributes, type CommandProps } from '@tiptap/core'
import { TextSelection, type EditorState } from '@tiptap/pm/state'
import { CALLOUT_VARIANTS, DEFAULT_CALLOUT_EMOJI, type CalloutVariant } from '@/lib/notes/palette'

export interface CalloutAttrs {
  emoji: string
  variant: CalloutVariant
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** Wrap the current block(s) in a callout. */
      setCallout: (attrs?: Partial<CalloutAttrs>) => ReturnType
      /** Insert an empty callout at the cursor (used by the slash menu). */
      insertCallout: (attrs?: Partial<CalloutAttrs>) => ReturnType
      /** Change the variant of the callout around the cursor. */
      setCalloutVariant: (variant: CalloutVariant) => ReturnType
      /** Change the emoji of the callout around the cursor. */
      setCalloutEmoji: (emoji: string) => ReturnType
    }
  }
}

const isVariant = (value: unknown): value is CalloutVariant =>
  CALLOUT_VARIANTS.includes(value as CalloutVariant)

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      emoji: {
        default: DEFAULT_CALLOUT_EMOJI,
        parseHTML: (el) => el.getAttribute('data-emoji') || DEFAULT_CALLOUT_EMOJI,
        renderHTML: (attrs) => ({ 'data-emoji': attrs.emoji }),
      },
      variant: {
        default: 'info',
        parseHTML: (el) => {
          const v = el.getAttribute('data-variant')
          return isVariant(v) ? v : 'info'
        },
        renderHTML: (attrs) => ({ 'data-variant': attrs.variant }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-callout': '' }, HTMLAttributes), 0]
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div')
      dom.setAttribute('data-callout', '')
      const icon = document.createElement('span')
      icon.className = 'note-callout-emoji'
      icon.contentEditable = 'false'
      const body = document.createElement('div')
      body.className = 'note-callout-body'
      dom.append(icon, body)
      const sync = (n: typeof node) => {
        dom.setAttribute('data-variant', n.attrs.variant)
        dom.setAttribute('data-emoji', n.attrs.emoji)
        icon.textContent = n.attrs.emoji
      }
      sync(node)
      // The emoji opens the picker (rendered by the page via CalloutEmojiPicker) through an event.
      icon.addEventListener('mousedown', (e) => {
        e.preventDefault()
        if (!editor.isEditable) return
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (pos === undefined) return
        editor.view.dom.dispatchEvent(
          new CustomEvent('note:callout-emoji', { bubbles: true, detail: { pos } }),
        )
      })
      return {
        dom,
        contentDOM: body,
        update(updated) {
          if (updated.type !== node.type) return false
          sync(updated)
          return true
        },
        ignoreMutation: (m) => !body.contains(m.target) && m.type !== 'selection',
      }
    }
  },

  addCommands() {
    const find = (state: EditorState) => {
      const { $from } = state.selection
      for (let d = $from.depth; d > 0; d--) {
        if ($from.node(d).type.name === this.name) {
          return { node: $from.node(d), pos: $from.before(d) }
        }
      }
      return null
    }
    const update =
      (patch: Partial<CalloutAttrs>) =>
      ({ state, tr, dispatch }: CommandProps) => {
        const found = find(state)
        if (!found) return false
        if (dispatch) tr.setNodeMarkup(found.pos, undefined, { ...found.node.attrs, ...patch })
        return true
      }
    return {
      setCallout:
        (attrs = {}) =>
        ({ commands }) =>
          commands.wrapIn(this.name, attrs),
      insertCallout:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { emoji: DEFAULT_CALLOUT_EMOJI, variant: 'info', ...attrs },
            content: [{ type: 'paragraph' }],
          }),
      setCalloutVariant: (variant) => update({ variant }),
      setCalloutEmoji: (emoji) => update({ emoji }),
    }
  },

  addKeyboardShortcuts() {
    return {
      // Enter on an empty last line leaves the callout (like a list).
      Enter: ({ editor }) => {
        const { state } = editor
        const { selection } = state
        if (!selection.empty) return false
        const { $from } = selection
        if (!$from.parent.isTextblock || $from.parent.content.size > 0) return false
        const calloutDepth = $from.depth - 1
        if (calloutDepth < 1 || $from.node(calloutDepth).type.name !== this.name) return false
        const callout = $from.node(calloutDepth)
        if ($from.index(calloutDepth) !== callout.childCount - 1) return false
        if (callout.childCount === 1) return editor.commands.lift(this.name)
        const emptyStart = $from.before()
        const emptyEnd = $from.after()
        const calloutEnd = $from.after(calloutDepth)
        return editor.commands.command(({ tr, dispatch }) => {
          if (!dispatch) return true
          tr.delete(emptyStart, emptyEnd)
          const insertAt = tr.mapping.map(calloutEnd)
          tr.insert(insertAt, state.schema.nodes.paragraph.create())
          tr.setSelection(TextSelection.create(tr.doc, insertAt + 1))
          return true
        })
      },
      // Backspace at the very start of the callout's first block lifts it out.
      Backspace: ({ editor }) => {
        const { selection } = editor.state
        if (!selection.empty) return false
        const { $from } = selection
        if ($from.parentOffset !== 0) return false
        const calloutDepth = $from.depth - 1
        if (calloutDepth < 1 || $from.node(calloutDepth).type.name !== this.name) return false
        if ($from.index(calloutDepth) !== 0) return false
        return editor.commands.lift(this.name)
      },
    }
  },
})
