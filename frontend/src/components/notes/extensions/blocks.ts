import type { AnyExtension } from '@tiptap/core'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import Highlight from '@tiptap/extension-highlight'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import { BlockHandle } from './blockHandle'
import { Callout } from './callout'
import { Toggle, ToggleSummary } from './toggle'

export { blockSlashItems } from '../slash/items-blocks'

/**
 * All Phase 2 block extensions. Append to the editor's extensions (after StarterKit):
 * `extensions: [StarterKit..., ...blockExtensions()]`.
 */
export function blockExtensions(): AnyExtension[] {
  return [
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Callout,
    ToggleSummary,
    Toggle,
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    BlockHandle,
  ]
}
