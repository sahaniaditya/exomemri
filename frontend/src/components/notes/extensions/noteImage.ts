import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import NoteImageView from '@/components/dashboard/NoteImageView'

/** Image node carrying the storage `key` (the signed `src` is re-minted on load). */
export const NoteImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      key: {
        default: null,
        parseHTML: element => element.getAttribute('data-key'),
        renderHTML: attributes =>
          attributes.key ? { 'data-key': attributes.key } : {},
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(NoteImageView)
  },
})
