import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { toCapturedSource } from '@/lib/dashboard-data'
import { atlasFontVars } from '@/lib/fonts'
import type { Profile } from '@/lib/profile'
import { getReviewQueue } from '@/lib/review'
import { getSpaceCoverage } from '@/lib/coverage'
import { getStudyPlan } from '@/lib/plan'
import { listSpaceSources, listSpaces } from '@/lib/spaces'
import styles from '@/components/dashboard/dashboard.module.css'
import CaptureFeed from '@/components/dashboard/CaptureFeed'
import ContourBg from '@/components/dashboard/ContourBg'
import CoverageCard from '@/components/dashboard/CoverageCard'
import Plate from '@/components/dashboard/Plate'
import PlanCard from '@/components/dashboard/PlanCard'
import SpaceHero from '@/components/dashboard/SpaceHero'
import SpacesSidebar from '@/components/dashboard/SpacesSideBar'

export const metadata: Metadata = {
  title: 'Learning Space · exomemri',
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
  const token = (await cookies()).get('atlas_token')?.value ?? ''

  const [profile, spaces, spaceSources, reviewQueue, coverage, planItems] = await Promise.all([
    loadProfile(token),
    listSpaces(token),
    listSpaceSources(token, spaceId),
    getReviewQueue(token, spaceId),
    getSpaceCoverage(token, spaceId),
    getStudyPlan(token, spaceId),
  ])

  const activeSpace = spaces.find(space => space.id === spaceId)
  if (!activeSpace) notFound()

  const captures = spaceSources.map(toCapturedSource)
  const sourceCount = activeSpace.source_counts.total
  const dueCount = reviewQueue.items.length + reviewQueue.total_pending

  return (
    <div className={`${styles.app} ${atlasFontVars}`}>
      <SpacesSidebar spaces={spaces} activeSpaceId={spaceId} />
      <main className={styles.main}>
        <ContourBg />
        <div className={styles.inner}>
          <SpaceHero
            space={activeSpace}
            profile={profile}
            sourceCount={sourceCount}
          />

          <section id="captures" className={styles.section}>
            <Plate
              num="01"
              title="Captured in this space"
              link={
                captures.length > 0
                  ? {
                      label: `${captures.length} ${captures.length === 1 ? 'item' : 'items'}`,
                      href: '#captures',
                    }
                  : undefined
              }
            />
            <CaptureFeed
              sources={captures}
              emptyTitle="Nothing in this space yet"
              emptyBody="Set this space as active in the extension, then capture a video, article, or chat — it will land here."
            />
          </section>

          {dueCount > 0 && (
            <section id="review" className={styles.section}>
              <Plate
                num="02"
                title="Due for review"
                link={{
                  label: `${dueCount} ${dueCount === 1 ? 'item' : 'items'} · start`,
                  href: `/dashboard/spaces/${spaceId}/review`,
                }}
              />
            </section>
          )}

          {planItems.length > 0 && (
            <section id="plan" className={styles.section}>
              <Plate num="03" title="Study plan" />
              <PlanCard spaceId={spaceId} items={planItems} />
            </section>
          )}

          {captures.length > 0 && (
            <section id="coverage" className={styles.section}>
              <Plate num="04" title="Coverage" />
              <CoverageCard coverage={coverage} />
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
