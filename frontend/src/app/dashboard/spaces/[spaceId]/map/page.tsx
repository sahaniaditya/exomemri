import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { getCredits } from '@/lib/credits'
import { atlasFontVars } from '@/lib/fonts'
import { getSpaceGraph, rankConcepts } from '@/lib/graph'
import { streakDays, type Profile } from '@/lib/profile'
import { listSpaces } from '@/lib/spaces'
import styles from '@/components/dashboard/dashboard.module.css'
import ContourBg from '@/components/dashboard/ContourBg'
import MapBackfill from '@/components/dashboard/MapBackfill'
import Plate from '@/components/dashboard/Plate'
import SpaceMapView from '@/components/dashboard/SpaceMapView'
import SpacesSidebar from '@/components/dashboard/SpacesSideBar'
import TopBar from '@/components/dashboard/TopBar'

export const metadata: Metadata = {
  title: 'Knowledge map · exomemri',
  description: 'Everything you have learned in this space, and how it connects.',
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

interface SpaceMapPageProps {
  params: Promise<{ spaceId: string }>
}

export default async function SpaceMapPage({ params }: SpaceMapPageProps) {
  const { spaceId } = await params
  const token = (await cookies()).get('atlas_token')?.value ?? ''

  const [profile, spaces, graph, credits] = await Promise.all([
    loadProfile(token),
    listSpaces(token),
    getSpaceGraph(token, spaceId),
    getCredits(token),
  ])

  const activeSpace = spaces.find(space => space.id === spaceId)
  if (!activeSpace) notFound()

  const ranked = rankConcepts(graph)
  const maxDegree = ranked.length > 0 ? ranked[0].degree : 0
  const totalSources = spaces.reduce((sum, space) => sum + space.source_counts.total, 0)

  return (
    <div className={`${styles.app} ${atlasFontVars}`}>
      <SpacesSidebar
        spaces={spaces}
        activeSpaceId={spaceId}
        profile={profile}
        streakDays={streakDays(profile)}
        credits={credits}
      />
      <main className={styles.main}>
        <ContourBg />
        <div className={styles.inner}>
          <TopBar
            profile={profile}
            totalSources={totalSources}
            spaceCount={spaces.length}
            streakDays={streakDays(profile)}
            variant="compact"
            credits={credits}
          />

          <Plate
            num="01"
            title={`${activeSpace.name} · knowledge map`}
            link={{ label: 'Back to captures', href: `/dashboard/spaces/${spaceId}` }}
          />
          <MapBackfill spaceId={spaceId} pending={graph.pending} />
          <SpaceMapView
            graph={graph}
            spaceId={spaceId}
            concepts={ranked}
            maxDegree={maxDegree}
          />
        </div>
      </main>
    </div>
  )
}
