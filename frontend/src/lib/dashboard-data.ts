/**
 * Dashboard view model.
 *
 * Spaces and captured sources are real now (`GET /v1/spaces`, `GET /v1/sources`)
 * and reach the page through the mappers at the bottom of this file. Stats, the
 * review queue, study gaps and the activity timeline still have no read
 * endpoints, so `getDashboardData()` remains placeholder data shaped like the
 * eventual API response for those sections only.
 */
import type { Source, Space, SourceType } from '@/lib/spaces'

export type SourceKind = 'video' | 'pdf' | 'chat' | 'article' | 'note'

export const SOURCE_GLYPH: Record<SourceKind, string> = {
  video: '▶',
  pdf: '◆',
  chat: '✦',
  article: '📰',
  note: '✎',
}

export interface ResumeItem {
  spaceName: string
  title: string
  kind: SourceKind
  duration: string
  stoppedAt: string
  progress: number
  unreadInSpace: number
}

export interface StatCard {
  value: string
  unit?: string
  label: string
  delta: string
  deltaPositive?: boolean
}

export interface LearningSpace {
  id: string
  name: string
  slug: string
  /** No coverage signal exists yet — real spaces report 0 until one does. */
  coverage: number
  counts: { video: number; article: number; pdf: number; chat: number; note: number }
  lastActive: string
}

export interface CapturedSource {
  id: string
  title: string
  spaceName: string
  spaceId: string
  kind: SourceKind
  meta: string
  capturedAt: string
  status: 'summarized' | 'summarizing'
}

export interface ReviewQueue {
  total: number
  breakdown: { spaceName: string; count: number }[]
}

export interface StudyGap {
  id: string
  concept: string
  spaceName: string
  reason: string
}

export interface ActivityDay {
  label: string
  intensity: number
  isToday?: boolean
}

/** The sections still awaiting read endpoints. Spaces and captures come from
 * the API via the mappers below, so they are deliberately absent here. */
export interface DashboardData {
  resume: ResumeItem | null
  stats: StatCard[]
  review: ReviewQueue
  gaps: StudyGap[]
  week: { days: ActivityDay[]; deltaLabel: string }
  streakDays: number
  totalSources: number
  plan: string
  extensionTabs: number
}

/** Real totals the caller already fetched, folded into the placeholder view. */
export interface DashboardTotals {
  spaceCount: number
  sourceCount: number
}

export function getDashboardData(totals: DashboardTotals): DashboardData {
  return {
    resume: {
      spaceName: 'System Design',
      title: 'Consistent Hashing Explained',
      kind: 'video',
      duration: 'YouTube · 14:22',
      stoppedAt: '9:47',
      progress: 62,
      unreadInSpace: 2,
    },
    stats: [
      // Real. The other two still have no signal behind them.
      { value: String(totals.sourceCount), label: 'Sources captured', delta: 'all time' },
      { value: '241', label: 'Concepts learned', delta: '+12 this week', deltaPositive: true },
      { value: String(totals.spaceCount), label: 'Learning Spaces', delta: 'all time' },
      { value: '68', unit: '%', label: 'Avg. coverage', delta: 'across all spaces' },
    ],
    review: {
      total: 18,
      breakdown: [
        { spaceName: 'System Design', count: 9 },
        { spaceName: 'Databases', count: 6 },
        { spaceName: 'ML', count: 3 },
      ],
    },
    gaps: [
      {
        id: 'g1',
        concept: 'Quorum reads & writes',
        spaceName: 'Distributed Databases',
        reason: 'saved, not reviewed',
      },
      {
        id: 'g2',
        concept: 'CAP theorem in practice',
        spaceName: 'Distributed Databases',
        reason: 'weak area',
      },
      {
        id: 'g3',
        concept: 'Backpropagation intuition',
        spaceName: 'Machine Learning',
        reason: 'not started',
      },
    ],
    week: {
      days: [
        { label: 'MON', intensity: 34 },
        { label: 'TUE', intensity: 58 },
        { label: 'WED', intensity: 22 },
        { label: 'THU', intensity: 71 },
        { label: 'FRI', intensity: 46 },
        { label: 'SAT', intensity: 15 },
        { label: 'SUN', intensity: 64, isToday: true },
      ],
      deltaLabel: '↑ 23% vs last week',
    },
    streakDays: 12,
    totalSources: totals.sourceCount,
    plan: 'FREE',
    extensionTabs: 4,
  }
}

// --- API → view model ---

const SOURCE_KIND: Record<SourceType, SourceKind> = {
  youtube: 'video',
  article: 'article',
  ai_chat: 'chat',
  pdf: 'pdf',
  note: 'note',
}

const SOURCE_LABEL: Record<SourceType, string> = {
  youtube: 'YouTube',
  article: 'Article',
  ai_chat: 'AI chat',
  pdf: 'PDF',
  note: 'Note',
}

/** Coarse "2h ago" style label. Rendered on the server, so the reference point
 * is request time — good enough for a feed, and no client/server drift since
 * nothing re-renders it. */
export function relativeTime(iso: string | null): string {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'never'

  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`

  const weeks = Math.round(days / 7)
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
}

export function toLearningSpace(space: Space): LearningSpace {
  const counts = space.source_counts
  return {
    id: space.id,
    name: space.name,
    slug: space.slug,
    coverage: 0,
    counts: {
      video: counts.youtube,
      article: counts.article,
      pdf: counts.pdf,
      chat: counts.ai_chat,
      note: counts.note,
    },
    lastActive: space.last_captured_at
      ? relativeTime(space.last_captured_at)
      : 'no captures yet',
  }
}

export function toCapturedSource(source: Source): CapturedSource {
  return {
    id: source.id,
    title: source.title,
    spaceName: source.space_name ?? '—',
    spaceId:source.space_id,
    kind: SOURCE_KIND[source.type],
    meta: source.author
      ? `${SOURCE_LABEL[source.type]} · ${source.author}`
      : SOURCE_LABEL[source.type],
    capturedAt: relativeTime(source.captured_at),
    // Nothing processes captures yet, so anything not `ready` is still in flight.
    status: source.processing_status === 'ready' ? 'summarized' : 'summarizing',
  }
}
