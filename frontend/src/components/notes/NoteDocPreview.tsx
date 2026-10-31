/**
 * Read-only render of stored TipTap JSON as plain React elements (no innerHTML).
 * Unknown nodes degrade to their children or text, never throw.
 */
import type { ReactNode } from 'react'

import styles from './notes-intelligence.module.css'

interface Mark {
  type: string
  attrs?: Record<string, unknown>
}

interface DocNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  marks?: Mark[]
  content?: DocNode[]
}

const SAFE_HREF = /^(https?:|mailto:)/i

function renderText(node: DocNode, key: number): ReactNode {
  let out: ReactNode = node.text ?? ''
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') out = <strong>{out}</strong>
    else if (mark.type === 'italic') out = <em>{out}</em>
    else if (mark.type === 'strike') out = <s>{out}</s>
    else if (mark.type === 'code') out = <code>{out}</code>
    else if (mark.type === 'link') {
      const href = String(mark.attrs?.href ?? '')
      if (SAFE_HREF.test(href)) {
        out = (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {out}
          </a>
        )
      }
    }
  }
  return <span key={key}>{out}</span>
}

function renderChildren(node: DocNode): ReactNode[] {
  return (node.content ?? []).map((child, index) => renderNode(child, index))
}

function renderNode(node: DocNode, key: number): ReactNode {
  switch (node.type) {
    case 'text':
      return renderText(node, key)
    case 'paragraph':
      return <p key={key}>{renderChildren(node)}</p>
    case 'heading': {
      const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 1))
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
      return <Tag key={key}>{renderChildren(node)}</Tag>
    }
    case 'bulletList':
      return <ul key={key}>{renderChildren(node)}</ul>
    case 'orderedList':
      return <ol key={key}>{renderChildren(node)}</ol>
    case 'listItem':
      return <li key={key}>{renderChildren(node)}</li>
    case 'blockquote':
      return <blockquote key={key}>{renderChildren(node)}</blockquote>
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{(node.content ?? []).map(child => child.text ?? '').join('')}</code>
        </pre>
      )
    case 'horizontalRule':
      return <hr key={key} />
    case 'hardBreak':
      return <br key={key} />
    case 'image':
      return (
        <p key={key} className={styles.previewMuted}>
          [image]
        </p>
      )
    default:
      return node.content ? <div key={key}>{renderChildren(node)}</div> : null
  }
}

export default function NoteDocPreview({ content }: { content: Record<string, unknown> }) {
  const doc = content as DocNode
  const blocks = renderChildren(doc)
  return (
    <div className={styles.preview} data-testid="note-doc-preview">
      {blocks.length ? blocks : <p className={styles.previewMuted}>This version is empty.</p>}
    </div>
  )
}
