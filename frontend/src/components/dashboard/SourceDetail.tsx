'use client'
/**
 * Capture workspace: full-width details; "Ask this capture" opens a
 * right overlay drawer (does not reserve a permanent layout column).
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './dashboard.module.css'
import SourceSummary from './SourceSummary'
import SourceNotes from './SourceNotes'
import SourceChatPanel from './SourceChatPanel'
import OriginalLink from './OriginalLink'
import SourceIcon from './SourceIcon'
import DeleteCaptureButton from './DeleteCaptureButton'
import ThemeToggle from './ThemeToggle'
import {
  SOURCE_KIND,
  captureStatus,
  relativeTime,
  type SourceKind,
} from '@/lib/dashboard-data'
import type { Source } from '@/lib/spaces'
import {
  captureNotesPlateNum,
  type ChatMessage,
  type SummaryResponse,
} from '@/lib/sources'
import type { NotePage } from '@/lib/notes'
import type { Collaborator, ShareLinkStatus } from '@/lib/sharing'
import ShareManager from './ShareManager'

const KIND_LABEL: Record<SourceKind, string> = {
  video: 'YouTube',
  article: 'Article',
  chat: 'AI chat',
  pdf: 'PDF',
  note: 'Note',
}

const POLL_MS = 2500

interface SourceDetailProps {
  source: Source
  spaceName: string
  initialSummary: SummaryResponse | null
  initialMessages: ChatMessage[]
  initialNotes: NotePage[]
  notesLoadError?: boolean
  initialCollaborators?: Collaborator[]
  initialShareLink?: ShareLinkStatus
  readOnly?: boolean
}

export default function SourceDetail({
  source,
  spaceName,
  initialSummary,
  initialMessages,
  initialNotes,
  notesLoadError = false,
  initialCollaborators = [],
  initialShareLink,
  readOnly = false,
}: SourceDetailProps) {
  const router = useRouter()
  const [chatOpen, setChatOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const kind = SOURCE_KIND[source.type]
  const status = captureStatus(source.processing_status)

  useEffect(() => {
    if (status !== 'processing') return
    const id = window.setInterval(() => {
      router.refresh()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [status, router])

  return (
    <div className={styles.captureShell}>
      <div className={styles.captureMain}>
        <header className={styles.captureHero}>
          <div className={styles.captureHeroMark} aria-hidden="true">
            <SourceIcon kind={kind} size={28} />
          </div>
          <div className={styles.captureHeroCopy}>
            <div className={styles.captureHeroTop}>
              <div className={styles.captureKind}>
                <span>{KIND_LABEL[kind]}</span>
              </div>
              {status === 'processing' ? (
                <span className={`${styles.status} ${styles.wip}`}>
                  <span className={styles.statusDot} aria-hidden="true" />
                  Processing
                </span>
              ) : status === 'failed' ? (
                <span className={`${styles.status} ${styles.fail}`}>Failed</span>
              ) : (
                <span className={`${styles.status} ${styles.done}`}>Ready</span>
              )}
            </div>
            <h1 className={styles.captureTitle}>{source.title}</h1>
            <ul className={styles.captureMetaChips}>
              <li>
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" aria-hidden="true">
                  <path d="M4 7h16v12H4z" />
                  <path d="M8 7V5h8v2" />
                </svg>
                {spaceName}
              </li>
              {source.author ? (
                <li>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" aria-hidden="true">
                    <circle cx="12" cy="8" r="3.2" />
                    <path d="M5.5 19c1.6-3.2 4-4.8 6.5-4.8S17.4 15.8 19 19" />
                  </svg>
                  {source.author}
                </li>
              ) : null}
              {source.captured_at ? (
                <li>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" aria-hidden="true">
                    <circle cx="12" cy="12" r="8" />
                    <path d="M12 8v4.5l3 1.5" />
                  </svg>
                  Captured {relativeTime(source.captured_at)}
                </li>
              ) : null}
              <li className={styles.captureThemeToggle}>
                <ThemeToggle />
              </li>
            </ul>
             
          </div>
          <div className={styles.captureActions}>
            {source.url ? <OriginalLink url={source.url} /> : null}
            {readOnly ? null : (
              <>
                <button
                  type="button"
                  className={styles.captureShareBtn}
                  onClick={() => setShareOpen(true)}
                  aria-label="Share"
                  title="Share"
                >
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="8" cy="10" r="2.4" />
                    <circle cx="16" cy="7" r="2.4" />
                    <circle cx="16" cy="15" r="2.4" />
                    <path d="M10 10.8 14 8.2M10 11.4 14 13.8" />
                  </svg>
                  <span className={styles.captureActionLabel}>Share</span>
                </button>
                <button
                  type="button"
                  className={styles.captureAskBtn}
                  onClick={() => setChatOpen(true)}
                  aria-expanded={chatOpen}
                  aria-label="Ask this capture"
                  title="Ask this capture"
                  disabled={status === 'processing'}
                >
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
                    <path d="M5 8.5C5 6.6 6.8 5 9 5h6c2.2 0 4 1.6 4 3.5V14c0 1.9-1.8 3.5-4 3.5h-3.2L8 21v-3.5C6.2 17.3 5 15.8 5 14V8.5Z" />
                    <path d="M9 10h6M9 13h4" />
                  </svg>
                  <span className={styles.captureActionLabel}>Ask this capture</span>
                </button>
                <DeleteCaptureButton
                  sourceId={source.id}
                  title={source.title}
                  redirectTo={`/dashboard/spaces/${source.space_id}`}
                  variant="hero"
                />
              </>
            )}
          </div>
        </header>
        {initialSummary?.sections ? (
          <SourceSummary
            summary={initialSummary.summary}
            sections={initialSummary.sections}
          />
        ) : (
          <div className={styles.captureEmptySummary}>
            <div className={styles.captureEmptyIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6">
                <path d="M6 5h12v14H6z" />
                <path d="M9 9h6M9 12h6M9 15h4" />
              </svg>
            </div>
            <div className={styles.et}>
              {status === 'failed'
                ? 'Processing failed'
                : status === 'processing'
                  ? 'Summary not ready yet'
                  : 'Summary unavailable'}
            </div>
            <p>
              {status === 'failed'
                ? 'Something went wrong while understanding this capture. Try capturing it again.'
                : status === 'processing'
                  ? 'This capture is still being understood. Key points will appear here when processing finishes.'
                  : 'A summary appears after this capture has been processed. If processing failed, try capturing it again.'}
            </p>
          </div>
        )}
        <SourceNotes
          key={source.id}
          scope={{ kind: 'source', sourceId: source.id }}
          initialNotes={initialNotes}
          loadError={notesLoadError}
          editable={!readOnly}
          plateNum={captureNotesPlateNum(initialSummary?.summary)}
        />
      </div>
      {readOnly ? null : (
        <ShareManager
          key={source.id}
          sourceId={source.id}
          initialCollaborators={initialCollaborators}
          initialShareLink={initialShareLink}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
      {!readOnly && chatOpen ? (
        <SourceChatPanel
          sourceId={source.id}
          sourceTitle={source.title}
          initialMessages={initialMessages}
          onClose={() => setChatOpen(false)}
        />
      ) : null}
    </div>
  )
}