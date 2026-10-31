'use client'

/** Node view for `noteMention` / `sourceMention`: an inline chip linking to the target. */
import Link from 'next/link'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { getSpaceIdFromPath } from '@/lib/notes/linkables'
import { notePath, sourcePath } from '@/lib/notes/types'
import styles from './notes.module.css'

export default function MentionView({ node }: NodeViewProps) {
  const isNote = node.type.name === 'noteMention'
  const id = String(isNote ? node.attrs.noteId : node.attrs.sourceId)
  const title = String(node.attrs.title || (isNote ? 'Untitled' : 'Untitled capture'))
  const spaceId =
    typeof window === 'undefined' ? null : getSpaceIdFromPath(window.location.pathname)
  const href = spaceId ? (isNote ? notePath(spaceId, id) : sourcePath(spaceId, id)) : '#'

  return (
    <NodeViewWrapper as="span" data-mention={node.type.name}>
      <Link href={href} className={styles.mentionChip} contentEditable={false}>
        {isNote ? '' : '📎 '}
        {title}
      </Link>
    </NodeViewWrapper>
  )
}
