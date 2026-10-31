'use client'

/** Outgoing links (captures and pages this page references) and backlinks. */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchLinks } from '@/lib/notes/client'
import { NO_ICON } from '@/lib/notes/constants'
import { notePath, sourcePath, type NoteLinks } from '@/lib/notes/types'
import styles from './notes.module.css'

interface BacklinksPanelProps {
  spaceId: string
  noteId: string
  /** Bump to refetch after the page is saved. */
  refreshKey?: string | number | null
}

export default function BacklinksPanel({ spaceId, noteId, refreshKey }: BacklinksPanelProps) {
  const [links, setLinks] = useState<NoteLinks | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetchLinks(spaceId, noteId)
      .then(data => {
        if (!alive) return
        setLinks(data)
        setFailed(false)
      })
      .catch(caught => {
        if (!alive) return
        console.error('Failed to load note links:', caught)
        setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [spaceId, noteId, refreshKey])

  if (failed && !links) {
    return (
      <div className={styles.panel} role="alert">
        Could not load links.
      </div>
    )
  }
  if (!links) return <div className={styles.panel}>Loading links…</div>

  return (
    <section className={styles.panel} aria-label="Links">
      <h2 className={styles.panelTitle}>Links from this page</h2>
      {links.outgoing.length === 0 ? (
        <p className={styles.panelEmpty}>No captures or pages linked yet.</p>
      ) : (
        <ul className={styles.panelList}>
          {links.outgoing.map(link => (
            <li key={`${link.type}-${link.id}`}>
              <Link
                className={styles.panelLink}
                href={
                  link.type === 'source'
                    ? sourcePath(spaceId, link.id)
                    : notePath(spaceId, link.id)
                }
              >
                <span aria-hidden="true">{link.type === 'source' ? '📎' : NO_ICON}</span>{' '}
                {link.title || 'Untitled'}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2 className={styles.panelTitle}>Linked from</h2>
      {links.incoming.length === 0 ? (
        <p className={styles.panelEmpty}>No pages link here.</p>
      ) : (
        <ul className={styles.panelList}>
          {links.incoming.map(link => (
            <li key={link.id}>
              <Link className={styles.panelLink} href={notePath(spaceId, link.id)}>
                <span aria-hidden="true">{link.icon || NO_ICON}</span> {link.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
