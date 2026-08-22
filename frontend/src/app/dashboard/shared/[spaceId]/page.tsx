import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { toCapturedSource } from '@/lib/dashboard-data'
import { atlasFontVars } from '@/lib/fonts'
import { getSpaceGraph, rankConcepts } from '@/lib/graph'
import { listSharedWithMe } from '@/lib/sharing'
import { listSpaceSources } from '@/lib/spaces'
import styles from '@/components/dashboard/dashboard.module.css'
import CaptureFeed from '@/components/dashboard/CaptureFeed'
import ContourBg from '@/components/dashboard/ContourBg'
import Plate from '@/components/dashboard/Plate'
import Sidebar from '@/components/dashboard/Sidebar'
import SpaceMapView from '@/components/dashboard/SpaceMapView'

export const metadata: Metadata = {
  title: 'Shared Learning Space · exomemri',
  description: 'A Learning Space someone shared with you, read-only.',
}

interface SharedSpacePageProps {
  params: Promise<{ spaceId: string }>
}

export default async function SharedSpacePage({ params }: SharedSpacePageProps) {
  const { spaceId } = await params
  const token = (await cookies()).get('atlas_token')?.value ?? ''

  const shared = await listSharedWithMe(token)
  const space = shared.find(s => s.id === spaceId)
  if (!space) notFound()

  const [sources, graph] = await Promise.all([
    listSpaceSources(token, spaceId),
    getSpaceGraph(token, spaceId),
  ])

  const captures = sources.map(toCapturedSource)
  const ranked = rankConcepts(graph)
  const maxDegree = ranked.length > 0 ? ranked[0].degree : 0

  return (
    <div className={`${styles.app} ${atlasFontVars}`}>
      <Sidebar spaceCount={0} sourceCount={captures.length} />
      <main className={styles.main}>
        <ContourBg />
        <div className={styles.inner}>
          <Plate
            num="—"
            title={`${space.name}${space.owner_username ? ` · shared by ${space.owner_username}` : ''}`}
          />
          <p className={styles.covempty}>
            Read-only — you&apos;re viewing what {space.owner_username ?? 'the owner'} captured
            here.
          </p>

          <section id="captures" className={styles.section}>
            <Plate num="01" title="Captured sources" />
            <CaptureFeed
              sources={captures}
              emptyTitle="Nothing captured here yet"
              emptyBody="The owner hasn't saved anything into this space yet."
            />
          </section>

          {ranked.length > 0 && (
            <section id="map" className={styles.section}>
              <Plate num="02" title="Knowledge map" />
              <SpaceMapView
                graph={graph}
                spaceId={spaceId}
                concepts={ranked}
                maxDegree={maxDegree}
              />
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
