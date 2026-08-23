import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { toCapturedSource, toLearningSpace } from '@/lib/dashboard-data'
import { atlasFontVars } from '@/lib/fonts'
import { streakDays as getStreakDays, type Profile } from '@/lib/profile'
import { listSharedWithMe } from '@/lib/sharing'
import { listRecentSources, listSpaces } from '@/lib/spaces'
import styles from '@/components/dashboard/dashboard.module.css'
import CaptureFeed from '@/components/dashboard/CaptureFeed'
import ContourBg from '@/components/dashboard/ContourBg'
import Plate from '@/components/dashboard/Plate'
import Sidebar from '@/components/dashboard/Sidebar'
import SharedWithMeList from '@/components/dashboard/SharedWithMeList'
import SpacesGrid from '@/components/dashboard/SpacesGrid'
import TopBar from '@/components/dashboard/TopBar'

export const metadata: Metadata = {
  title: 'Overview · exomemri',
  description: 'Your learning memory at a glance.',
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

export default async function DashboardPage() {
  const token = (await cookies()).get('atlas_token')?.value ?? ''
  const [profile, apiSpaces, recentSources, sharedSpaces] = await Promise.all([
    loadProfile(token),
    listSpaces(token),
    listRecentSources(token),
    listSharedWithMe(token),
  ])
  const spaces = apiSpaces.map(toLearningSpace)
  const captures = recentSources.map(toCapturedSource)
  const totalSources = apiSpaces.reduce((sum, space) => sum + space.source_counts.total, 0)

  return (
    <div className={`${styles.app} ${atlasFontVars}`}>
      <Sidebar spaceCount={spaces.length} sourceCount={totalSources} />
      <main className={styles.main}>
        <ContourBg />
        <div className={styles.inner}>
          <TopBar
            profile={profile}
            totalSources={totalSources}
            spaceCount={spaces.length}
            streakDays={getStreakDays(profile)}
          />

          <section id="spaces" className={styles.section}>
            <Plate num="01" title="Your Learning Spaces" />
            <SpacesGrid spaces={spaces} />
          </section>

          <section id="captures" className={styles.section}>
            <Plate
              num="02"
              title="Recently captured"
              link={
                captures.length > 0
                  ? { label: `${captures.length} latest`, href: '#captures' }
                  : undefined
              }
            />
            <CaptureFeed sources={captures} canDelete />
          </section>

          {sharedSpaces.length > 0 && (
            <section id="shared" className={styles.section}>
              <Plate num="03" title="Shared with you" />
              <SharedWithMeList sources={sharedSpaces} />
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
