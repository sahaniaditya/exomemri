import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { apiFetch } from '@/lib/api'
import { toCapturedSource, toLearningSpace } from '@/lib/dashboard-data'
import { atlasFontVars } from '@/lib/fonts'
import type { Profile } from '@/lib/profile'
import { listRecentSources, listSpaces } from '@/lib/spaces'
import styles from '@/components/dashboard/dashboard.module.css'
import CaptureFeed from '@/components/dashboard/CaptureFeed'
import ContourBg from '@/components/dashboard/ContourBg'
import Plate from '@/components/dashboard/Plate'
import Sidebar from '@/components/dashboard/Sidebar'
import SpacesGrid from '@/components/dashboard/SpacesGrid'
import TopBar from '@/components/dashboard/TopBar'

export const metadata: Metadata = {
  title: 'Overview · Atlas',
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
  // The layout already gated auth/onboarding, so a token is expected here.
  const token = (await cookies()).get('atlas_token')?.value ?? ''
  const [profile, apiSpaces, recentSources] = await Promise.all([
    loadProfile(token),
    listSpaces(token),
    listRecentSources(token),
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
          <TopBar profile={profile} totalSources={totalSources} spaceCount={spaces.length} />

          <Plate
            num="01"
            title="Your Learning Spaces"
          />
          <SpacesGrid spaces={spaces} />

          <Plate num="02" title="Recently captured" />
          <CaptureFeed sources={captures} />
        </div>
      </main>
    </div>
  )
}