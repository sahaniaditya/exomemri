'use client'

/**
 * TipTap node view for a note code snippet: the block plus a copy control.
 */
import { useEffect, useRef, useState } from 'react'
import CodeBlock from '@tiptap/extension-code-block'
import type { NodeViewProps } from '@tiptap/react'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import styles from './dashboard.module.css'

function fallbackCopyText(text: string): boolean {
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.left = '-9999px'
  document.body.appendChild(field)
  field.select()
  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(field)
  }
}

function NoteCodeBlockView({ node, selected }: NodeViewProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const copyTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) window.clearTimeout(copyTimer.current)
    }
  }, [])

  async function copy() {
    const text = node.textContent
    let ok = false
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch {
      ok = fallbackCopyText(text)
    }
    setCopyState(ok ? 'copied' : 'error')
    if (copyTimer.current !== null) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopyState('idle'), 1500)
  }

  const copyLabel =
    copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Couldn’t copy' : 'Copy'
  const copyAria =
    copyState === 'copied'
      ? 'Copied snippet'
      : copyState === 'error'
        ? 'Couldn’t copy snippet'
        : 'Copy snippet'

  return (
    <NodeViewWrapper
      as="div"
      className={styles.notesCodeWrap}
      data-selected={selected ? 'true' : undefined}
    >
      <div className={styles.notesCodeBar} contentEditable={false}>
        <span className={styles.notesCodeLabel}>Snippet</span>
        <button
          type="button"
          className={styles.notesCodeCopy}
          aria-label={copyAria}
          onMouseDown={event => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={event => {
            event.preventDefault()
            event.stopPropagation()
            void copy()
          }}
        >
          {copyLabel}
        </button>
      </div>
      <NodeViewContent className={styles.notesCodePre} />
    </NodeViewWrapper>
  )
}

export const NoteCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(NoteCodeBlockView)
  },
})

export default NoteCodeBlockView
