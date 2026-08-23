'use client'

/**
 * Canvas layer for the knowledge map. Imported only via next/dynamic({ ssr: false })
 * so force-graph never evaluates `window` during SSR, and so the ForceGraph2D ref
 * works (next/dynamic does not forward refs to the inner component).
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from 'react'
import { useRouter } from 'next/navigation'
import ForceGraph2D, {
  type ForceGraphMethods,
  type NodeObject,
} from 'react-force-graph-2d'
import {
  buildAdjacency,
  type MapNode,
  type MapModel,
} from '@/lib/graph'
import type { SourceKind } from '@/lib/dashboard-data'

const CONCEPT_BASE_RADIUS = 7
const SOURCE_RADIUS = 11
const FOREST = '#2C5D4F'
const CLAY = '#B5623C'
const INK = '#1B1A16'
const CARD = '#FBFAF6'
const SAGE = '#7C8A7E'
const PAPER = '#F4F1E9'

const KIND_LABEL: Record<SourceKind, string> = {
  video: 'Video',
  article: 'Article',
  chat: 'AI chat',
  pdf: 'PDF',
  note: 'Note',
}

type GraphNode = MapNode & {
  val: number
  x?: number
  y?: number
  fx?: number
  fy?: number
}

function conceptRadius(degree: number): number {
  return CONCEPT_BASE_RADIUS + Math.sqrt(Math.max(0, degree - 1)) * 4.5
}

function nodeRadius(node: MapNode): number {
  return node.kind === 'concept' ? conceptRadius(node.degree) : SOURCE_RADIUS
}

export interface KnowledgeMapCanvasProps {
  model: MapModel
  spaceId: string
  width: number
  height: number
  focused: string | null
  stickyFocus: boolean
  onHoverId: (id: string | null) => void
  onFocusConcept: (conceptId: string | null) => void
  graphKey: string
  fgRef: MutableRefObject<ForceGraphMethods<GraphNode> | undefined>
}

export default function KnowledgeMapCanvas({
  model,
  spaceId,
  width,
  height,
  focused,
  stickyFocus,
  onHoverId,
  onFocusConcept,
  graphKey,
  fgRef,
}: KnowledgeMapCanvasProps) {
  const router = useRouter()
  const fittedKey = useRef('')
  const adjacency = useMemo(() => buildAdjacency(model.links), [model.links])

  const graphData = useMemo(() => {
    const nodes: GraphNode[] = model.nodes.map(n => ({
      ...n,
      val: nodeRadius(n),
    }))
    const links = model.links.map(l => ({
      source: l.source,
      target: l.target,
      weight: l.weight,
    }))
    return { nodes, links }
  }, [model])

  const isDimmed = useCallback(
    (id: string) =>
      focused !== null && id !== focused && !adjacency.get(focused)?.has(id),
    [focused, adjacency]
  )

  // Tune forces once the instance exists.
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const charge = fg.d3Force('charge')
    if (charge && typeof charge.strength === 'function') {
      charge.strength(-280)
    }
    const link = fg.d3Force('link')
    if (link && typeof link.distance === 'function') {
      link.distance((l: { weight?: number }) => 120 - (l.weight ?? 0.5) * 40)
      if (typeof link.strength === 'function') link.strength(0.55)
    }
  }, [fgRef, graphData])

  const paintNode = useCallback(
    (node: NodeObject<GraphNode>, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as GraphNode
      const x = node.x ?? 0
      const y = node.y ?? 0
      const r = nodeRadius(n)
      const dim = isDimmed(n.id)

      ctx.save()
      ctx.globalAlpha = dim ? 0.16 : 1

      if (n.kind === 'concept') {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, 2 * Math.PI)
        ctx.fillStyle = n.isSpine ? CLAY : FOREST
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = CARD
        ctx.stroke()

        if (n.degree >= 2 || focused === n.id) {
          const fontSize = Math.max(11, 13 / globalScale)
          ctx.font = `${fontSize}px Newsreader, Georgia, serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.lineWidth = 3.5 / globalScale
          ctx.strokeStyle = CARD
          ctx.fillStyle = INK
          ctx.strokeText(n.label, x, y + r + 4)
          ctx.fillText(n.label, x, y + r + 4)
        }
      } else {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, 2 * Math.PI)
        ctx.fillStyle = CARD
        ctx.fill()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = SAGE
        ctx.stroke()

        ctx.beginPath()
        ctx.arc(x, y, 3.5, 0, 2 * Math.PI)
        ctx.fillStyle = FOREST
        ctx.fill()

        if (focused === n.id) {
          const title = n.title.length > 42 ? `${n.title.slice(0, 42)}…` : n.title
          const fontSize = Math.max(10, 11.5 / globalScale)
          ctx.font = `500 ${fontSize}px "Instrument Sans", system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.lineWidth = 3.5 / globalScale
          ctx.strokeStyle = CARD
          ctx.fillStyle = SAGE
          ctx.strokeText(title, x, y + r + 5)
          ctx.fillText(title, x, y + r + 5)
        }
      }

      ctx.restore()
    },
    [focused, isDimmed]
  )

  const paintPointerArea = useCallback(
    (node: NodeObject<GraphNode>, color: string, ctx: CanvasRenderingContext2D) => {
      const n = node as GraphNode
      ctx.beginPath()
      ctx.arc(node.x ?? 0, node.y ?? 0, nodeRadius(n) + 4, 0, 2 * Math.PI)
      ctx.fillStyle = color
      ctx.fill()
    },
    []
  )

  const linkColor = useCallback(
    (link: { source?: unknown; target?: unknown; weight?: number }) => {
      const sourceId =
        typeof link.source === 'object' && link.source && 'id' in link.source
          ? String((link.source as { id: string }).id)
          : String(link.source)
      const targetId =
        typeof link.target === 'object' && link.target && 'id' in link.target
          ? String((link.target as { id: string }).id)
          : String(link.target)
      const dim = isDimmed(sourceId) && isDimmed(targetId)
      const weight = link.weight ?? 0.5
      return `rgba(27, 26, 22, ${dim ? 0.06 : 0.15 + weight * 0.4})`
    },
    [isDimmed]
  )

  const onNodeClick = useCallback(
    (node: NodeObject<GraphNode>) => {
      const n = node as GraphNode
      if (n.kind === 'source') {
        router.push(`/dashboard/spaces/${spaceId}/sources/${n.id}`)
        return
      }
      onFocusConcept(focused === n.id ? null : n.id)
      onHoverId(null)
    },
    [router, spaceId, focused, onFocusConcept, onHoverId]
  )

  const onEngineStop = useCallback(() => {
    const key = `${graphKey}:${width}`
    if (fittedKey.current === key) return
    fittedKey.current = key
    fgRef.current?.zoomToFit(400, 48)
  }, [fgRef, graphKey, width])

  // List → map: pan/zoom to the sticky concept.
  useEffect(() => {
    if (!stickyFocus || !focused || !fgRef.current) return
    const node = graphData.nodes.find(n => n.id === focused)
    if (!node || node.x == null || node.y == null) return
    fgRef.current.centerAt(node.x, node.y, 600)
    fgRef.current.zoom(2.2, 600)
  }, [stickyFocus, focused, graphData.nodes, fgRef])

  // Reset fit key when the graph shape changes so the next cool-down re-fits.
  useEffect(() => {
    fittedKey.current = ''
  }, [graphKey])

  return (
    <ForceGraph2D
      ref={fgRef}
      graphData={graphData}
      width={width}
      height={height}
      backgroundColor={PAPER}
      nodeId="id"
      linkSource="source"
      linkTarget="target"
      nodeLabel={(node: NodeObject<GraphNode>) => {
        const n = node as GraphNode
        return n.kind === 'concept'
          ? `${n.label} · ${n.degree} ${n.degree === 1 ? 'source' : 'sources'}`
          : `${KIND_LABEL[n.sourceKind]}: ${n.title}`
      }}
      nodeCanvasObjectMode={() => 'replace'}
      nodeCanvasObject={paintNode}
      nodePointerAreaPaint={paintPointerArea}
      linkColor={linkColor}
      linkWidth={(link: { weight?: number } & Record<string, unknown>) =>
        1 + (link.weight ?? 0.5)
      }
      cooldownTicks={120}
      warmupTicks={40}
      d3AlphaDecay={0.028}
      d3VelocityDecay={0.35}
      onEngineStop={onEngineStop}
      onNodeClick={onNodeClick}
      onBackgroundClick={() => {
        onFocusConcept(null)
        onHoverId(null)
      }}
      onNodeHover={(node: NodeObject<GraphNode> | null) => {
        if (stickyFocus) return
        onHoverId(node ? String((node as GraphNode).id) : null)
      }}
      onNodeDragEnd={(node: NodeObject<GraphNode>) => {
        node.fx = node.x
        node.fy = node.y
      }}
      enableNodeDrag
      enableZoomInteraction
      enablePanInteraction
    />
  )
}

export type { GraphNode }
