'use client'

/**
 * TipTap node view for a note image: the photo plus a top-left overlay
 * that removes it from the document.
 */
import type { NodeViewProps } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'
import styles from './dashboard.module.css'

export default function NoteImageView({ node, deleteNode, selected }: NodeViewProps) {
  const src = typeof node.attrs.src === 'string' ? node.attrs.src : ''
  const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : ''

  return (
    <NodeViewWrapper
      className={styles.notesImageWrap}
      data-selected={selected ? 'true' : undefined}
    >
      <button
        type="button"
        className={styles.notesImageDelete}
        aria-label="Remove image"
        contentEditable={false}
        onClick={event => {
          event.preventDefault()
          event.stopPropagation()
          deleteNode()
        }}
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path
            d="M3.5 3.5l9 9M12.5 3.5l-9 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} draggable={false} />
    </NodeViewWrapper>
  )
}
