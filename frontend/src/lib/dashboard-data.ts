/**
 * Dashboard view model.
 *
 * The backend currently exposes only auth/profile and source *capture*
 * (`POST /v1/sources`) — there are no read endpoints for spaces, stats,
 * review queue or the activity timeline yet. Everything below is placeholder
 * data shaped like the eventual API response, so swapping in real fetches
 * later means replacing `getDashboardData()` and nothing else.
 */

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
  coverage: number
  counts: { video: number; pdf: number; chat: number; note: number }
  lastActive: string
}

export interface CapturedSource {
  id: string
  title: string
  spaceName: string
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

export interface DashboardData {
  resume: ResumeItem | null
  stats: StatCard[]
  spaces: LearningSpace[]
  captures: CapturedSource[]
  review: ReviewQueue
  gaps: StudyGap[]
  week: { days: ActivityDay[]; deltaLabel: string }
  streakDays: number
  totalSources: number
  plan: string
  extensionTabs: number
}

export function getDashboardData(): DashboardData {
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
      { value: '82', label: 'Sources captured', delta: '+7 this week', deltaPositive: true },
      { value: '241', label: 'Concepts learned', delta: '+12 this week', deltaPositive: true },
      { value: '6', label: 'Learning Spaces', delta: '2 active today' },
      { value: '68', unit: '%', label: 'Avg. coverage', delta: 'across all spaces' },
    ],
    spaces: [
      {
        id: 'system-design',
        name: 'System Design',
        coverage: 70,
        counts: { video: 9, pdf: 3, chat: 5, note: 4 },
        lastActive: 'active today',
      },
      {
        id: 'distributed-databases',
        name: 'Distributed Databases',
        coverage: 54,
        counts: { video: 6, pdf: 5, chat: 2, note: 1 },
        lastActive: '2 days ago',
      },
      {
        id: 'react-frontend',
        name: 'React & Frontend',
        coverage: 88,
        counts: { video: 12, pdf: 1, chat: 8, note: 6 },
        lastActive: '5 days ago',
      },
      {
        id: 'machine-learning',
        name: 'Machine Learning',
        coverage: 41,
        counts: { video: 8, pdf: 7, chat: 3, note: 2 },
        lastActive: '1 week ago',
      },
      {
        id: 'behavioral-prep',
        name: 'Behavioral Prep',
        coverage: 63,
        counts: { video: 4, pdf: 2, chat: 6, note: 3 },
        lastActive: '3 days ago',
      },
    ],
    captures: [
      {
        id: 'c1',
        title: 'Consistent Hashing Explained',
        spaceName: 'System Design',
        kind: 'video',
        meta: 'YouTube · 14:22',
        capturedAt: '2h ago',
        status: 'summarized',
      },
      {
        id: 'c2',
        title: 'ChatGPT — load balancer trade-offs',
        spaceName: 'System Design',
        kind: 'chat',
        meta: 'AI chat · 22 msgs',
        capturedAt: '3h ago',
        status: 'summarized',
      },
      {
        id: 'c3',
        title: 'Designing Data-Intensive Apps — ch. 6',
        spaceName: 'Distributed Databases',
        kind: 'pdf',
        meta: 'PDF · p.184',
        capturedAt: '5h ago',
        status: 'summarizing',
      },
      {
        id: 'c4',
        title: 'The Log: What every engineer should know',
        spaceName: 'Distributed Databases',
        kind: 'article',
        meta: 'Article · 18 min',
        capturedAt: 'Yesterday',
        status: 'summarized',
      },
      {
        id: 'c5',
        title: 'Kafka Internals Deep Dive',
        spaceName: 'Distributed Databases',
        kind: 'video',
        meta: 'YouTube · 41:09',
        capturedAt: 'Yesterday',
        status: 'summarized',
      },
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
    totalSources: 82,
    plan: 'FREE',
    extensionTabs: 4,
  }
}
