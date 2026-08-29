import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { toCapturedSource } from '@/lib/dashboard-data'
import { atlasFontVars } from '@/lib/fonts'
import { streakDays, type Profile } from '@/lib/profile'
import { getSpaceCoverage } from '@/lib/coverage'
import { getStudyPlan } from '@/lib/plan'
import { listSpaceFolders, listSpaceSources, listSpaces } from '@/lib/spaces'
import { listSpaceNotes } from '@/lib/notes'
import styles from '@/components/dashboard/dashboard.module.css'
import { NewFolderButton } from '@/components/dashboard/NewFolderDialog'
import SpaceCaptureFeed from '@/components/dashboard/SpaceCaptureFeed'
import ContourBg from '@/components/dashboard/ContourBg'
import CoverageCard from '@/components/dashboard/CoverageCard'
import Plate from '@/components/dashboard/Plate'
import PlanCard from '@/components/dashboard/PlanCard'
import SpaceHero from '@/components/dashboard/SpaceHero'
import SpaceNotes from '@/components/dashboard/SpaceNotes'
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

  const [profile, spaces, spaceSources, folders, coverage, planItems, notesResult] =
    await Promise.all([
      loadProfile(token),
      listSpaces(token),
      listSpaceSources(token, spaceId),
      listSpaceFolders(token, spaceId),
      getSpaceCoverage(token, spaceId),
      getStudyPlan(token, spaceId),
      listSpaceNotes(token, spaceId),
    ])

  const activeSpace = spaces.find(space => space.id === spaceId)
  if (!activeSpace) notFound()

  const captures = spaceSources.map(toCapturedSource)
  const sourceCount = activeSpace.source_counts.total

  return (
    <div className={`${styles.app} ${atlasFontVars}`}>
      <SpacesSidebar
        spaces={spaces}
        activeSpaceId={spaceId}
        profile={profile}
        streakDays={streakDays(profile)}
      />
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
              action={<NewFolderButton spaceId={spaceId} />}
              link={
                captures.length > 0
                  ? {
                      label: `${captures.length} ${captures.length === 1 ? 'item' : 'items'}`,
                      href: '#captures',
                    }
                  : undefined
              }
            />
            <SpaceCaptureFeed
              spaceId={spaceId}
              sources={captures}
              folders={folders}
              canEdit
              emptyTitle="Nothing in this space yet"
              emptyBody="Set this space as active in the extension, then capture a video, article, or chat — it will land here."
            />
          </section>

          <section id="space-notes" className={styles.section}>
            <SpaceNotes
              spaceId={spaceId}
              plateNum="02"
              initialNotes={notesResult.items}
              loadError={notesResult.error}
            />
          </section>

          {planItems.length > 0 && (
            <section id="plan" className={styles.section}>
              <Plate num="03" title="Suggested next topics" />
              <PlanCard items={planItems} />
            </section>
          )}

          {captures.length > 0 && (
            <section id="coverage" className={styles.section}>
              <Plate
                num={planItems.length > 0 ? '04' : '03'}
                title="Coverage"
              />
              <CoverageCard coverage={coverage} spaceId={spaceId} />
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
