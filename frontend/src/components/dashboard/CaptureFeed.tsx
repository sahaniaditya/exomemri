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

interface CaptureFeedProps {
  sources: CapturedSource[]
  /** Override empty-state copy for space-scoped feeds. */
  emptyTitle?: string
  emptyBody?: string
  extraActions?: (source: CapturedSource) => ReactNode
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
      <span className={`${styles.status} ${styles.fail}`}>
        Failed
      </span>
    )
  }
  return (
    <span className={`${styles.status} ${styles.done}`}>Ready</span>
  )
}

export function CaptureRow({
  source,
  extraActions,
}: {
  source: CapturedSource
  extraActions?: ReactNode
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
            <div className={styles.srctitle}>{source.title}</div>
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
          <StatusBadge status={source.status} />
        </div>
      </Link>
      <div className={styles.srcActions}>
        {extraActions}
        {source.url ? <OriginalLink url={source.url} /> : null}
        <Link
          href={`/dashboard/spaces/${source.spaceId}/sources/${source.id}`}
          className={styles.srcOpenInApp}
          aria-label={`Open ${source.title} in exomemri`}
        >
          <span aria-hidden="true">→</span>
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
          />
        ))}
      </div>
    </div>
  )
}
