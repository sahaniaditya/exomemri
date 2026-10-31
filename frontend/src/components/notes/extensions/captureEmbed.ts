/**
 * `captureEmbed`: a block atom that embeds a capture from the space.
 * Attributes (a cross-phase contract): sourceId, title, sourceType, timestampSec.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import CaptureEmbedView from '../CaptureEmbedView'

export const CaptureEmbed = Node.create({
  name: 'captureEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      sourceId: {
        default: '',
        parseHTML: el => el.getAttribute('data-source-id') ?? '',
        renderHTML: attrs => ({ 'data-source-id': attrs.sourceId }),
      },
      title: {
        default: '',
        parseHTML: el => el.getAttribute('data-title') ?? '',
        renderHTML: attrs => ({ 'data-title': attrs.title }),
      },
      sourceType: {
        default: '',
        parseHTML: el => el.getAttribute('data-source-type') ?? '',
        renderHTML: attrs => ({ 'data-source-type': attrs.sourceType }),
      },
      timestampSec: {
        default: null,
        parseHTML: el => {
          const raw = el.getAttribute('data-timestamp-sec')
          const value = raw === null || raw === '' ? NaN : Number(raw)
          return Number.isFinite(value) ? value : null
        },
        renderHTML: attrs =>
          attrs.timestampSec === null ? {} : { 'data-timestamp-sec': String(attrs.timestampSec) },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-capture-embed]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({ 'data-capture-embed': '' }, HTMLAttributes),
      String(node.attrs.title || 'Capture'),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CaptureEmbedView)
  },
})
