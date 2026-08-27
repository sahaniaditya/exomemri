import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { getCredits } from '@/lib/credits'
import { atlasFontVars } from '@/lib/fonts'
import { streakDays, type Profile } from '@/lib/profile'
import { listSpaceSources, listSpaces } from '@/lib/spaces'
import { getSourceSummary, listSourceMessages } from '@/lib/sources'
import { listSourceNotes } from '@/lib/notes'
import { listCollaborators, getShareLinkStatus } from '@/lib/sharing'
import styles from '@/components/dashboard/dashboard.module.css'
import ContourBg from '@/components/dashboard/ContourBg'
import SourceDetail from '@/components/dashboard/SourceDetail'
import SourceSidebar from '@/components/dashboard/SourceSidebar'

export const metadata: Metadata = {
  title: 'Source · exomemri',
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

  const [profile, spaces, sourcesInSpace, credits] = await Promise.all([
    loadProfile(token),
    listSpaces(token),
    listSpaceSources(token, spaceId),
    getCredits(token),
  ])

  const activeSpace = spaces.find(s => s.id === spaceId)
  const activeSource = sourcesInSpace.find(s => s.id === sourceId)
  if (!activeSpace || !activeSource) notFound()

  const [summary, messages, notesResult, collaborators, shareLink] = await Promise.all([
    getSourceSummary(token, sourceId),
    listSourceMessages(token, sourceId),
    listSourceNotes(token, sourceId),
    listCollaborators(token, sourceId),
    getShareLinkStatus(token, sourceId),
  ])

  return (
    <div className={`${styles.app} ${styles.appSource} ${atlasFontVars}`}>
      <SourceSidebar
        space={activeSpace}
        sources={sourcesInSpace}
        activeSourceId={sourceId}
        profile={profile}
        streakDays={streakDays(profile)}
        credits={credits}
      />
      <main className={styles.main}>
        <ContourBg />
        <div className={styles.captureInner}>
          <SourceDetail
            source={activeSource}
            spaceName={activeSpace.name}
            initialSummary={summary}
            initialMessages={messages}
            initialNotes={notesResult.items}
            notesLoadError={notesResult.error}
            initialCollaborators={collaborators}
            initialShareLink={shareLink}
          />
        </div>
      </main>
    </div>
  )
}
