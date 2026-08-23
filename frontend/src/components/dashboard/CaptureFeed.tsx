'use client'

/**
 * Capture list with live status badges.
 * While any row is still processing, refresh the server tree so
 * Processing → Ready / Failed without a manual reload.
 */
import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  isCaptureProcessing,
  type CapturedSource,
} from '@/lib/dashboard-data'
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

const POLL_MS = 2500

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
  const pending = sources.some(source => isCaptureProcessing(source.status))

  useEffect(() => {
    if (!pending) return
    const id = window.setInterval(() => {
      router.refresh()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [pending, router])

  if (sources.length === 0) {
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
        {sources.map(source => (
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
