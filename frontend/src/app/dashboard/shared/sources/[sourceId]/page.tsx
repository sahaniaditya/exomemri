import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { getCredits } from '@/lib/credits'
import { atlasFontVars } from '@/lib/fonts'
import { streakDays, type Profile } from '@/lib/profile'
import { listSharedWithMe } from '@/lib/sharing'
import { getSourceSummary } from '@/lib/sources'
import { listSourceNotes } from '@/lib/notes'
import type { Source } from '@/lib/spaces'
import styles from '@/components/dashboard/dashboard.module.css'
import ContourBg from '@/components/dashboard/ContourBg'
import SourceDetail from '@/components/dashboard/SourceDetail'
import Sidebar from '@/components/dashboard/Sidebar'
import Plate from '@/components/dashboard/Plate'

export const metadata: Metadata = {
  title: 'Shared capture · exomemri',
  description: 'A capture someone shared with you, read-only.',
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

interface SharedSourcePageProps {
  params: Promise<{ sourceId: string }>
}

export default async function SharedSourcePage({ params }: SharedSourcePageProps) {
  const { sourceId } = await params
  const token = (await cookies()).get('atlas_token')?.value ?? ''

  const [shared, profile, credits] = await Promise.all([
    listSharedWithMe(token),
    loadProfile(token),
    getCredits(token),
  ])
  const row = shared.find(s => s.source_id === sourceId)
  if (!row) notFound()

  const source: Source = {
    id: row.source_id,
    space_id: row.space_id,
    space_name: row.space_name,
    type: row.type,
    title: row.title,
    url: row.url,
    author: row.author,
    captured_at: row.captured_at,
    processing_status: row.processing_status,
    folder_id: null,
  }

  const [summary, notesResult] = await Promise.all([
    getSourceSummary(token, sourceId),
    listSourceNotes(token, sourceId),
  ])

  const byline = row.owner_username
    ? `${row.space_name} · shared by ${row.owner_username}`
    : row.space_name

  return (
    <div className={`${styles.app} ${styles.appSource} ${atlasFontVars}`}>
      <Sidebar
        spaceCount={0}
        sourceCount={1}
        profile={profile}
        streakDays={streakDays(profile)}
        credits={credits}
      />
      <main className={styles.main}>
        <ContourBg />
        <div className={styles.captureInner}>
          <Plate num="—" title={byline} />
          <p className={styles.covempty}>
            Read-only — you can view the summary and notes.
          </p>
          <SourceDetail
            source={source}
            spaceName={row.space_name}
            initialSummary={summary}
            initialMessages={[]}
            initialNotes={notesResult.items}
            notesLoadError={notesResult.error}
            readOnly
          />
        </div>
      </main>
    </div>
  )
}
