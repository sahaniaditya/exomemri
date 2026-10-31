/**
 * Inline mention atoms (a cross-phase contract):
 * `noteMention { noteId, title }` and `sourceMention { sourceId, title }`.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import MentionView from '../MentionView'

function mentionNode(name: 'noteMention' | 'sourceMention', idAttr: 'noteId' | 'sourceId') {
  const dataId = idAttr === 'noteId' ? 'data-note-id' : 'data-source-id'
  return Node.create({
    name,
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,

    addAttributes() {
      return {
        [idAttr]: {
          default: '',
          parseHTML: el => el.getAttribute(dataId) ?? '',
          renderHTML: attrs => ({ [dataId]: attrs[idAttr] }),
        },
        title: {
          default: '',
          parseHTML: el => el.getAttribute('data-title') ?? '',
          renderHTML: attrs => ({ 'data-title': attrs.title }),
        },
      }
    },

    parseHTML() {
      return [{ tag: `span[data-${name}]` }]
    },

    renderHTML({ node, HTMLAttributes }) {
      return [
        'span',
        mergeAttributes({ [`data-${name}`]: '' }, HTMLAttributes),
        String(node.attrs.title || ''),
      ]
    },

    addNodeView() {
      return ReactNodeViewRenderer(MentionView, { as: 'span' })
    },
  })
}

export const NoteMention = mentionNode('noteMention', 'noteId')
export const SourceMention = mentionNode('sourceMention', 'sourceId')
