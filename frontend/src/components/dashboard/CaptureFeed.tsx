'use client'

/**
 * Capture list with live status badges.
 * Subscribes to a Realtime feed: status changes on existing rows are
 * patched in place instantly; a brand-new capture triggers a single
 * router.refresh() so the server-rendered row (with spaceName, meta,
 * etc. computed server-side) appears without a manual reload.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { CapturedSource } from '@/lib/dashboard-data'
import { useCaptureSocket } from '@/lib/use-capture-socket'
import styles from './dashboard.module.css'
import SourceIcon from './SourceIcon'
import OriginalLink from './OriginalLink'
import DeleteCaptureButton from './DeleteCaptureButton'

interface CaptureFeedProps {
  sources: CapturedSource[]
  /** Override empty-state copy for space-scoped feeds. */
  emptyTitle?: string
  emptyBody?: string
  extraActions?: (source: CapturedSource) => ReactNode
  canDelete?: boolean
}

function StatusBadge({ status }: { status: CapturedSource['status'] }) {
  if (status === 'processing') {
    return (
      <span className={`${styles.status} ${styles.wip}`}>
        <span className={styles.statusDot} aria-hidden="true" />
        Processing
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className={`${styles.status} ${styles.fail}`}>Failed</span>
    )
  }
  return null
}

export function CaptureRow({
  source,
  extraActions,
  canDelete,
}: {
  source: CapturedSource
  extraActions?: ReactNode
  canDelete?: boolean
}) {
  return (
    <div className={styles.srcRow}>
      <Link
        href={`/dashboard/spaces/${source.spaceId}/sources/${source.id}`}
        className={styles.srcLink}
      >
        <div className={styles.src}>
          <div className={styles.srcico} aria-hidden="true">
            <SourceIcon kind={source.kind} size={16} />
          </div>
          <div className={styles.srcmain}>
            <div className={styles.srcTitleRow}>
              <div className={styles.srctitle}>{source.title}</div>
              <StatusBadge status={source.status} />
            </div>
            <div className={styles.srcmeta}>
              <span className={styles.tag}>{source.spaceName}</span>
              <span className={styles.metaSep} aria-hidden="true">
                ·
              </span>
              <span>{source.meta}</span>
              <span className={styles.metaSep} aria-hidden="true">
                ·
              </span>
              <span>{source.capturedAt}</span>
            </div>
          </div>
        </div>
      </Link>
      <div className={styles.srcActions}>
        {extraActions}
        {source.url ? <OriginalLink url={source.url} compact /> : null}
        {canDelete ? (
          <DeleteCaptureButton sourceId={source.id} title={source.title} />
        ) : null}
        {extraActions || source.url || canDelete ? (
          <span className={styles.srcActionSep} aria-hidden="true" />
        ) : null}
        <Link
          href={`/dashboard/spaces/${source.spaceId}/sources/${source.id}`}
          className={styles.srcOpenInApp}
          aria-label={`Open ${source.title}`}
          title="Open"
        >
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
    </div>
  )
}

export default function CaptureFeed({
  sources,
  emptyTitle = 'No captures yet',
  emptyBody = 'Install the browser extension, open a video or article, and save it into a Learning Space — it will show up here.',
  extraActions,
  canDelete,
}: CaptureFeedProps) {
  const router = useRouter()

  // Local mirror of the server-provided sources, patched in place by
  // incoming UPDATE events. Re-synced whenever the server sends a fresh
  // `sources` prop — including after the router.refresh() triggered by
  // a new-capture INSERT event below.
  const [liveSources, setLiveSources] = useState(sources)

  useEffect(() => {
    setLiveSources(sources)
  }, [sources])

  const spaceIds = useMemo(
    () => Array.from(new Set(sources.map(s => s.spaceId))),
    [sources]
  )

  useCaptureSocket(
    spaceIds,
    event => {
      setLiveSources(prev =>
        prev.map(source =>
          source.id === event.sourceId ? { ...source, ...event.patch } : source
        )
      )
    },
    () => {
      // A brand-new capture landed for one of these spaces. Refetch the
      // server-rendered list so it appears with its correct spaceName,
      // meta, etc. — no full page reload, no flash.
      router.refresh()
    }
  )

  if (liveSources.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.et}>{emptyTitle}</div>
        <p>{emptyBody}</p>
      </div>
    )
  }

  return (
    <div className={styles.feedPanel}>
      <div className={styles.feed}>
        {liveSources.map(source => (
          <CaptureRow
            key={source.id}
            source={source}
            extraActions={extraActions?.(source)}
            canDelete={canDelete}
          />
        ))}
      </div>
    </div>
  )
}