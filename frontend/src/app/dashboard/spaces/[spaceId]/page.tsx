
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { toCapturedSource, toLearningSpace } from '@/lib/dashboard-data'
import { atlasFontVars } from '@/lib/fonts'
import type { Profile } from '@/lib/profile'
import { listSpaceSources, listSpaces } from '@/lib/spaces'
import styles from '@/components/dashboard/dashboard.module.css'
import CaptureFeed from '@/components/dashboard/CaptureFeed'
import ContourBg from '@/components/dashboard/ContourBg'
import Plate from '@/components/dashboard/Plate'
import SpacesSidebar from '@/components/dashboard/SpacesSideBar'
import TopBar from '@/components/dashboard/TopBar'


export const metadata: Metadata = {
  title: 'Learning Space · Atlas',
  description: 'Sources captured into this learning space.',
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

interface SpaceSourcesPageProps {
  params: Promise<{ spaceId: string }>
}

export default async function SpaceSourcesPage({ params }: SpaceSourcesPageProps) {
  const { spaceId } = await params
  // The layout already gated auth/onboarding, so a token is expected here.
 
  const token = (await cookies()).get('atlas_token')?.value ?? ''
 

  const [profile, spaces, spaceSources] = await Promise.all([
    loadProfile(token),
    listSpaces(token),
    listSpaceSources(token, spaceId),
  ])

 
  const activeSpace = spaces.find(space => space.id === spaceId)
  
  if (!activeSpace) notFound()
  const captures = spaceSources.map(toCapturedSource)
  const totalSources = spaces.reduce((sum, space) => sum + space.source_counts.total, 0)

  return (
    <div className={`${styles.app} ${atlasFontVars}`}>
      <SpacesSidebar spaces={spaces} activeSpaceId={spaceId} />
      <main className={styles.main}>
        <ContourBg />
        <div className={styles.inner}>
          <TopBar profile={profile} totalSources={totalSources} />

          <Plate num="01" title={activeSpace.name} />
          <CaptureFeed sources={captures} />
        </div>
      </main>
    </div>
  )
}