/**
 * The knowledge map's data layer.
 *
 * Shapes mirror `SpaceGraphResponse` in `backend/app/schemas/concepts.py`.
 * Everything the canvas needs computed — degree pruning, source lookup, the
 * concept/source adjacency — is derived here so `KnowledgeMap` only maps props
 * to markup (same division as `lib/dashboard-data.ts` -> `StatsRow`).
 */
import { apiFetch } from '@/lib/api'
import { SOURCE_KIND, type SourceKind } from '@/lib/dashboard-data'
import type { SourceType } from '@/lib/spaces'

export interface ConceptNode {
  id: string
  label: string
  slug: string
  /** How many sources in this space reference the concept. */
  degree: number
}

export interface GraphSourceNode {
  id: string
  title: string
  type: SourceType
  captured_at: string | null
}

export interface GraphEdge {
  source_id: string
  concept_id: string
  weight: number
}

export interface SpaceGraph {
  concepts: ConceptNode[]
  sources: GraphSourceNode[]
  edges: GraphEdge[]
  /** Sources with no concepts extracted yet — drives the backfill progress UI. */
  pending: number
}

export const EMPTY_GRAPH: SpaceGraph = { concepts: [], sources: [], edges: [], pending: 0 }

/** One space's whole map. Empty on any failure, like the other lib readers. */
export async function getSpaceGraph(token: string, spaceId: string): Promise<SpaceGraph> {
  try {
    const res = await apiFetch(`/v1/spaces/${spaceId}/graph`, {}, token)
    if (!res.ok) return EMPTY_GRAPH
    return (await res.json()) as SpaceGraph
  } catch (error) {
    console.error('Failed to load the space knowledge map:', error)
    return EMPTY_GRAPH
  }
}

// --- view model ---

export interface MapConcept extends ConceptNode {
  kind: 'concept'
  /** Highest-degree band in this space — the map's spine, drawn in clay. */
  isSpine: boolean
}

export interface MapSource {
  kind: 'source'
  id: string
  title: string
  sourceKind: SourceKind
}

export type MapNode = MapConcept | MapSource

export interface MapLink {
  source: string
  target: string
  weight: number
}

export interface MapModel {
  nodes: MapNode[]
  links: MapLink[]
  /** Concepts hidden because only one source mentions them. */
  prunedCount: number
  /** Source kinds actually present, for the legend. */
  kinds: SourceKind[]
}

/**
 * A concept referenced by only one source adds a leaf that carries no
 * convergence information — the whole point of the map. Hidden by default,
 * revealed by the "show all concepts" toggle.
 */
const MIN_INTERESTING_DEGREE = 2

/**
 * Build the render model.
 *
 * `showAll` keeps degree-1 concepts; sources left with no visible concept are
 * dropped too, so the canvas never shows a floating source with no explanation
 * of why it's there.
 */
export function toMapModel(graph: SpaceGraph, showAll: boolean): MapModel {
  const minDegree = showAll ? 1 : MIN_INTERESTING_DEGREE
  const visibleConcepts = graph.concepts.filter(c => c.degree >= minDegree)
  const prunedCount = graph.concepts.length - visibleConcepts.length

  // Highest degree in the space defines the spine band, so a small space with a
  // max degree of 2 still highlights something and a large one isn't all clay.
  const maxDegree = visibleConcepts.reduce((max, c) => Math.max(max, c.degree), 0)
  const spineThreshold = Math.max(MIN_INTERESTING_DEGREE, maxDegree)

  const visibleConceptIds = new Set(visibleConcepts.map(c => c.id))
  const links = graph.edges
    .filter(e => visibleConceptIds.has(e.concept_id))
    .map(e => ({ source: e.source_id, target: e.concept_id, weight: e.weight }))

  const linkedSourceIds = new Set(links.map(l => l.source))
  const visibleSources = graph.sources.filter(s => linkedSourceIds.has(s.id))

  const nodes: MapNode[] = [
    ...visibleConcepts.map(
      (c): MapConcept => ({ ...c, kind: 'concept', isSpine: c.degree >= spineThreshold })
    ),
    ...visibleSources.map(
      (s): MapSource => ({
        kind: 'source',
        id: s.id,
        title: s.title,
        sourceKind: SOURCE_KIND[s.type],
      })
    ),
  ]

  const kinds = [...new Set(visibleSources.map(s => SOURCE_KIND[s.type]))]

  return { nodes, links, prunedCount, kinds }
}

/**
 * Adjacency for the focus interaction: node id -> the ids one hop away.
 * Precomputed once so hovering doesn't re-scan every link on each pointer move.
 */
export function buildAdjacency(links: MapLink[]): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()
  const connect = (a: string, b: string) => {
    const set = adjacency.get(a) ?? new Set<string>()
    set.add(b)
    adjacency.set(a, set)
  }
  for (const link of links) {
    connect(link.source, link.target)
    connect(link.target, link.source)
  }
  return adjacency
}

/** Concepts ranked for the side panel: strongest first, then alphabetical. */
export function rankConcepts(graph: SpaceGraph): ConceptNode[] {
  return [...graph.concepts].sort(
    (a, b) => b.degree - a.degree || a.label.localeCompare(b.label)
  )
}
