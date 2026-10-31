import type { Extension, Mark, Node } from '@tiptap/core'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { NoteCodeBlock } from '@/components/dashboard/NoteCodeBlockView'
import type { NotesScope } from '@/lib/notes'
import { SlashExtension } from '../slash/slashExtension'
import { basicSlashItems } from '../slash/items-basic'
import type { SlashItem } from '../slash/types'
import { NoteImage } from './noteImage'

export type NoteExtension = Extension | Node | Mark

export interface BuildNoteExtensionsOptions {
  /** Slash items; defaults to the basic set. Later phases pass the concatenated list. */
  slashItems?: SlashItem[]
}

export function notePlaceholder(scope: NotesScope): string {
  return scope.kind === 'space'
    ? 'Jot what you want to remember about this space…'
    : 'Jot what you want to remember from this capture…'
}

/**
 * Extensions for the full-page note editor. Headings 1 to 3 are enabled (so the Markdown
 * shortcuts `#`, `##`, `###`, `-`, `1.`, `>`, `---` and ``` work); the code block, link,
 * image and placeholder match the legacy capture-notes editor so saved documents load
 * unchanged. Returns an array so later phases can append their own extensions.
 */
export function buildNoteExtensions(
  scope: NotesScope,
  options: BuildNoteExtensionsOptions = {}
): NoteExtension[] {
  return [
    // `link` is configured separately below; StarterKit's own copy is disabled to avoid a duplicate.
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false, link: false }),
    NoteCodeBlock.configure({ enableTabIndentation: true }),
    Link.configure({
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
    }),
    NoteImage.configure({ inline: false, allowBase64: false }),
    Placeholder.configure({ placeholder: notePlaceholder(scope) }),
    SlashExtension.configure({ items: options.slashItems ?? basicSlashItems }),
  ]
}
