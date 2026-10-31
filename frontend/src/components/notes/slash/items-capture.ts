import { openLinkPicker, type LinkPickerMode } from '@/lib/notes/linkPicker'
import type { SlashItem } from './types'

const pickerItem = (
  id: string,
  title: string,
  description: string,
  icon: string,
  keywords: string[],
  mode: LinkPickerMode
): SlashItem => ({
  id,
  title,
  description,
  keywords,
  group: 'Captures',
  icon,
  run: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run()
    openLinkPicker(editor, mode)
  },
})

export const captureSlashItems: SlashItem[] = [
  pickerItem(
    'capture',
    'Capture',
    'Embed a capture from this space',
    '📎',
    ['capture', 'embed', 'source', 'video', 'article', 'pdf'],
    'capture'
  ),
  pickerItem(
    'link-to-page',
    'Link to page',
    'Mention another page in this space',
    '↗',
    ['link', 'page', 'mention', 'note', 'reference'],
    'page'
  ),
]
