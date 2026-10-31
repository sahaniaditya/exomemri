import { Node, mergeAttributes, type CommandProps } from '@tiptap/core'
import { Selection, TextSelection, type EditorState } from '@tiptap/pm/state'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toggle: {
      /** Insert an empty toggle at the cursor (used by the slash menu). */
      insertToggle: () => ReturnType
      /** Open or close the toggle around the cursor, or the one at `pos`. */
      setToggleOpen: (open: boolean, pos?: number) => ReturnType
    }
  }
}

function findToggle(state: EditorState, pos?: number) {
  if (pos !== undefined) {
    const node = state.doc.nodeAt(pos)
    return node?.type.name === 'toggle' ? { node, pos } : null
  }
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'toggle') return { node: $from.node(d), pos: $from.before(d) }
  }
  return null
}

export const ToggleSummary = Node.create({
  name: 'toggleSummary',
  content: 'inline*',
  defining: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'div[data-toggle-summary]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-toggle-summary': '' }, HTMLAttributes), 0]
  },

  addKeyboardShortcuts() {
    return {
      // Enter in the summary moves into the body (creating an empty first line when needed).
      Enter: ({ editor }) => {
        const { state } = editor
        const { $from } = state.selection
        if (!state.selection.empty || $from.parent.type.name !== this.name) return false
        const toggleDepth = $from.depth - 1
        const toggle = $from.node(toggleDepth)
        const togglePos = $from.before(toggleDepth)
        return editor.commands.command(({ tr, dispatch }) => {
          if (!dispatch) return true
          const summaryEnd = $from.after()
          if (toggle.childCount === 1) {
            tr.insert(summaryEnd, state.schema.nodes.paragraph.create())
          }
          if (!toggle.attrs.open) tr.setNodeMarkup(togglePos, undefined, { ...toggle.attrs, open: true })
          tr.setSelection(Selection.near(tr.doc.resolve(summaryEnd), 1))
          return true
        })
      },
    }
  },
})

export const Toggle = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'toggleSummary block*',
  defining: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: (el) => el.getAttribute('data-open') !== 'false',
        renderHTML: (attrs) => ({ 'data-open': String(attrs.open) }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-toggle]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes({ 'data-toggle': '' }, HTMLAttributes), 0]
  },

  addNodeView() {
    return ({ node, editor, getPos, view }) => {
      const dom = document.createElement('div')
      dom.setAttribute('data-toggle', '')
      const arrow = document.createElement('button')
      arrow.type = 'button'
      arrow.className = 'note-toggle-arrow'
      arrow.contentEditable = 'false'
      arrow.setAttribute('aria-label', 'Toggle')
      const content = document.createElement('div')
      content.className = 'note-toggle-content'
      dom.append(arrow, content)

      let open = node.attrs.open as boolean
      const sync = () => {
        dom.setAttribute('data-open', String(open))
        arrow.setAttribute('aria-expanded', String(open))
      }
      sync()

      arrow.addEventListener('mousedown', (e) => e.preventDefault())
      arrow.addEventListener('click', (e) => {
        e.preventDefault()
        const pos = typeof getPos === 'function' ? getPos() : undefined
        if (pos === undefined) return
        if (editor.isEditable) {
          // A real, undoable transaction so the state is stored in the document JSON.
          const current = view.state.doc.nodeAt(pos)
          if (!current) return
          view.dispatch(
            view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, open: !current.attrs.open }),
          )
        } else {
          // Read-only: fold locally without producing a document change.
          open = !open
          sync()
        }
      })

      return {
        dom,
        contentDOM: content,
        update(updated) {
          if (updated.type !== node.type) return false
          open = updated.attrs.open as boolean
          sync()
          return true
        },
        ignoreMutation: (m) => !content.contains(m.target) && m.type !== 'selection',
        stopEvent: (e) => e.target === arrow,
      }
    }
  },

  addCommands() {
    return {
      insertToggle:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { open: true },
            content: [{ type: 'toggleSummary' }, { type: 'paragraph' }],
          }),
      setToggleOpen:
        (open, pos) =>
        ({ state, tr, dispatch }: CommandProps) => {
          const found = findToggle(state, pos)
          if (!found) return false
          if (dispatch) tr.setNodeMarkup(found.pos, undefined, { ...found.node.attrs, open })
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Backspace at the start of an empty summary with no body turns the toggle into a paragraph.
      Backspace: ({ editor }) => {
        const { $from, empty } = editor.state.selection
        if (!empty || $from.parent.type.name !== 'toggleSummary' || $from.parent.content.size > 0) {
          return false
        }
        const toggleDepth = $from.depth - 1
        const toggle = $from.node(toggleDepth)
        if (toggle.childCount !== 1) return false
        const start = $from.before(toggleDepth)
        return editor.commands.command(({ tr, dispatch }) => {
          if (dispatch) {
            tr.replaceWith(start, start + toggle.nodeSize, editor.schema.nodes.paragraph.create())
            tr.setSelection(TextSelection.create(tr.doc, start + 1))
          }
          return true
        })
      },
    }
  },
})
