import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { atlasFontVars } from '@/lib/fonts'
import type { Profile } from '@/lib/profile'
import { listSpaceSources, listSpaces } from '@/lib/spaces'
import { getSourceSummary, listSourceMessages } from '@/lib/sources'
import styles from '@/components/dashboard/dashboard.module.css'
import ContourBg from '@/components/dashboard/ContourBg'
import SourceChat from '@/components/dashboard/SourceChat'
import SourceSidebar from '@/components/dashboard/SourceSidebar'
import TopBar from '@/components/dashboard/TopBar'

export const metadata: Metadata = {
  title: 'Source · Atlas',
}

async function loadProfile(token: string): Promise<Profile | null> {
  try {
    const res = await apiFetch('/v1/auth/me', {}, token)
    if (!res.ok) return null
    return (await res.json()) as Profile
  } catch (error) {
    console.error('Failed to load profile details:', error)
    return null
  }
}

interface SourcePageProps {
  params: Promise<{ spaceId: string; sourceId: string }>
}

export default async function SourcePage({ params }: SourcePageProps) {
  const { spaceId, sourceId } = await params
  const token = (await cookies()).get('atlas_token')?.value ?? ''

  const [profile, spaces, sourcesInSpace] = await Promise.all([
    loadProfile(token),
    listSpaces(token),
    listSpaceSources(token, spaceId),
  ])

  const activeSpace = spaces.find(s => s.id === spaceId)
  const activeSource = sourcesInSpace.find(s => s.id === sourceId)
  if (!activeSpace || !activeSource) notFound()

  // Summary generates lazily on first open here (GET with a cache-fill side
  // effect); every later visit just returns the cached row.
  const [summary, messages] = await Promise.all([
    getSourceSummary(token, sourceId),
    listSourceMessages(token, sourceId),
  ])

  const totalSources = spaces.reduce((sum, s) => sum + s.source_counts.total, 0)

  return (
    <div className={`${styles.app} ${atlasFontVars}`}>
      <SourceSidebar space={activeSpace} sources={sourcesInSpace} activeSourceId={sourceId} />
      <main className={styles.main}>
        <ContourBg />
        <div className={styles.inner}>
          <TopBar profile={profile} totalSources={totalSources} />
          <SourceChat
            sourceId={sourceId}
            sourceTitle={activeSource.title}
            initialSummary={summary}
            initialMessages={messages}
          />
        </div>
      </main>
    </div>
  )
}