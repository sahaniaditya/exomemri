/**
 * Slash items open the link picker through a DOM event on the editor element,
 * so they need no reference to the React tree. `<LinkPicker>` listens for it.
 */
import type { Editor } from '@tiptap/core'

export const LINK_PICKER_EVENT = 'notes:link-picker'

export type LinkPickerMode = 'capture' | 'page'

export interface LinkPickerDetail {
  mode: LinkPickerMode
  /** Document position to insert at once an item is chosen. */
  pos: number
}

export function openLinkPicker(editor: Editor, mode: LinkPickerMode): void {
  const detail: LinkPickerDetail = { mode, pos: editor.state.selection.from }
  editor.view.dom.dispatchEvent(new CustomEvent(LINK_PICKER_EVENT, { bubbles: true, detail }))
}

/** The ProseMirror JSON inserted for a chosen item. */
export function linkNodeFor(
  item: { kind: 'source' | 'note'; id: string; title: string; detail: string | null },
  mode: LinkPickerMode
): Record<string, unknown> {
  if (item.kind === 'note') {
    return { type: 'noteMention', attrs: { noteId: item.id, title: item.title } }
  }
  if (mode === 'capture') {
    return {
      type: 'captureEmbed',
      attrs: {
        sourceId: item.id,
        title: item.title,
        sourceType: item.detail ?? '',
        timestampSec: null,
      },
    }
  }
  return { type: 'sourceMention', attrs: { sourceId: item.id, title: item.title } }
}
