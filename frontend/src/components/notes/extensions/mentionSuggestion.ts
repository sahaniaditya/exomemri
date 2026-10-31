/**
 * `@` suggestion: lists this space's captures and pages and inserts a
 * `sourceMention` / `noteMention`.
 */
import { Extension, type Editor, type Range } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion'
import {
  filterLinkables,
  getNoteIdFromPath,
  getSpaceIdFromPath,
  loadLinkables,
  type LinkableItem,
} from '@/lib/notes/linkables'
import MentionPicker, {
  type MentionPickerHandle,
  type MentionPickerProps,
} from '../MentionPicker'
import styles from '../notes.module.css'

export interface MentionOptions {
  /** Defaults to the space in the current URL. */
  spaceId?: string
}

/** Content inserted for a chosen item (also what the tests assert on). */
export function mentionContent(item: LinkableItem) {
  const node =
    item.kind === 'note'
      ? { type: 'noteMention', attrs: { noteId: item.id, title: item.title } }
      : { type: 'sourceMention', attrs: { sourceId: item.id, title: item.title } }
  return [node, { type: 'text', text: ' ' }]
}

export function insertMention(editor: Editor, range: Range, item: LinkableItem): void {
  editor.chain().focus().insertContentAt(range, mentionContent(item)).run()
}

function createRenderer() {
  let component: ReactRenderer<MentionPickerHandle, MentionPickerProps> | null = null

  const place = (props: SuggestionProps<LinkableItem>) => {
    const rect = props.clientRect?.()
    if (!component || !rect) return
    const host = component.element as HTMLElement
    host.style.left = `${Math.max(8, rect.left)}px`
    host.style.top = `${rect.bottom + 6}px`
  }

  const teardown = () => {
    component?.element.remove()
    component?.destroy()
    component = null
  }

  return {
    onStart(props: SuggestionProps<LinkableItem>) {
      component = new ReactRenderer(MentionPicker, {
        editor: props.editor,
        props: { items: props.items, command: props.command },
      })
      const host = component.element as HTMLElement
      host.className = styles.suggestMenu
      document.body.appendChild(host)
      place(props)
    },
    onUpdate(props: SuggestionProps<LinkableItem>) {
      component?.updateProps({ items: props.items, command: props.command })
      place(props)
    },
    onKeyDown({ event }: { event: KeyboardEvent }) {
      if (event.key === 'Escape') {
        teardown()
        return true
      }
      return component?.ref?.onKeyDown(event) ?? false
    },
    onExit: teardown,
  }
}

export const MentionSuggestion = Extension.create<MentionOptions>({
  name: 'mentionSuggestion',

  addOptions() {
    return { spaceId: undefined }
  },

  addProseMirrorPlugins() {
    const resolveSpace = () => this.options.spaceId ?? getSpaceIdFromPath(window.location.pathname)
    return [
      Suggestion<LinkableItem, LinkableItem>({
        editor: this.editor,
        pluginKey: new PluginKey('mentionSuggestion'),
        char: '@',
        allowSpaces: false,
        items: async ({ query }) => {
          const spaceId = resolveSpace()
          if (!spaceId) return []
          try {
            const all = await loadLinkables(spaceId, getNoteIdFromPath(window.location.pathname))
            return filterLinkables(all, query)
          } catch (error) {
            console.error('Mention lookup failed:', error)
            return []
          }
        },
        command: ({ editor, range, props }) => insertMention(editor, range, props),
        render: createRenderer,
      }),
    ]
  },
})
