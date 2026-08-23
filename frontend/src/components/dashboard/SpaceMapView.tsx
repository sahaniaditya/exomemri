'use client'

/**
 * Holds sticky concept focus shared by the force-graph map and ConceptList.
 * The route page stays a server component and only passes fetched data here.
 */
import { useState } from 'react'
import KnowledgeMap from './KnowledgeMap'
import ConceptList from './ConceptList'
import Plate from './Plate'
import styles from './dashboard.module.css'
import type { ConceptNode, SpaceGraph } from '@/lib/graph'

interface SpaceMapViewProps {
  graph: SpaceGraph
  spaceId: string
  concepts: ConceptNode[]
  maxDegree: number
}

export default function SpaceMapView({
  graph,
  spaceId,
  concepts,
  maxDegree,
}: SpaceMapViewProps) {
  const [focusedConceptId, setFocusedConceptId] = useState<string | null>(null)

  return (
    <>
      <KnowledgeMap
        graph={graph}
        spaceId={spaceId}
        focusedConceptId={focusedConceptId}
        onFocusConcept={setFocusedConceptId}
      />

      <Plate num="02" title="What this space covers" />
      <p className={styles.coverageLead}>
        Click a concept to isolate it on the map — the same focus the graph uses when you
        hover or select a node.
      </p>
      <ConceptList
        concepts={concepts}
        maxDegree={maxDegree}
        focusedConceptId={focusedConceptId}
        onFocusConcept={setFocusedConceptId}
      />
    </>
  )
}
