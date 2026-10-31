'use client'

/** Node view for `captureEmbed`: a card linking to the capture, with an optional timestamp chip. */
import Link from 'next/link'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { getSpaceIdFromPath } from '@/lib/notes/linkables'
import { sourcePath } from '@/lib/notes/types'
import styles from './notes.module.css'

const TYPE_ICONS: Record<string, string> = {
  youtube: '▶️',
  article: '📰',
  ai_chat: '💬',
  pdf: '📕',
  note: '📝',
}

export function formatTimestamp(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export default function CaptureEmbedView({ node, selected }: NodeViewProps) {
  const { sourceId, title, sourceType, timestampSec } = node.attrs as {
    sourceId: string
    title: string
    sourceType: string
    timestampSec: number | null
  }
  const spaceId =
    typeof window === 'undefined' ? null : getSpaceIdFromPath(window.location.pathname)
  const href = spaceId ? sourcePath(spaceId, sourceId) : '#'
  const stamp = typeof timestampSec === 'number' ? timestampSec : null

  return (
    <NodeViewWrapper data-capture-embed="">
      <div
        className={`${styles.embedCard} ${selected ? styles.embedCardSelected : ''}`}
        contentEditable={false}
      >
        <span className={styles.embedIcon} aria-hidden="true">
          {TYPE_ICONS[sourceType] ?? '📎'}
        </span>
        <Link className={styles.embedBody} href={href} aria-label={`Open capture ${title}`}>
          <span className={styles.embedTitle}>{title || 'Untitled capture'}</span>
          <span className={styles.embedMeta}>{sourceType ? sourceType.replace('_', ' ') : 'capture'}</span>
        </Link>
        {stamp !== null && (
          <Link
            className={styles.embedChip}
            href={spaceId ? `${href}?t=${Math.floor(stamp)}` : '#'}
            aria-label={`Open at ${formatTimestamp(stamp)}`}
          >
            {formatTimestamp(stamp)}
          </Link>
        )}
      </div>
    </NodeViewWrapper>
  )
}
