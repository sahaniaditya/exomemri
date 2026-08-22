'use client'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import styles from './dashboard.module.css'
import SourceIcon from './SourceIcon'
import { buildAdjacency, toMapModel, type MapNode, type SpaceGraph } from '@/lib/graph'
import type { SourceKind } from '@/lib/dashboard-data'

const WIDTH = 900
const HEIGHT = 620
/** Ticks run to completion up front, then the layout is static — a permanently
 *  simmering simulation is distracting on a page you read rather than play with. */
const SETTLE_TICKS = 260
const CONCEPT_BASE_RADIUS = 7
const SOURCE_RADIUS = 11
const ZOOM_LIMITS = { min: 0.4, max: 3 }
/** Room reserved around the settled layout so labels (drawn below a node) and
 *  wide concept names are never clipped by the viewBox edge. */
const PAD_X = 90
const PAD_Y = 46

const KIND_LABEL: Record<SourceKind, string> = {
  video: 'Video',
  article: 'Article',
  chat: 'AI chat',
  pdf: 'PDF',
  note: 'Note',
}

type Positioned = MapNode & SimulationNodeDatum
type PositionedLink = SimulationLinkDatum<Positioned> & { weight: number }

/** Concept radius grows with degree but sub-linearly, so one hub concept in a
 *  large space doesn't dwarf everything else off the canvas. */
function conceptRadius(degree: number): number {
  return CONCEPT_BASE_RADIUS + Math.sqrt(Math.max(0, degree - 1)) * 4.5
}

/**
 * Translate (and, only if necessary, shrink) the settled layout so every node
 * and its label sits inside the viewBox.
 *
 * `forceCenter` centres the *mean* position, which says nothing about the
 * extremes — without this, a node on the rim of a wide layout lands on or past
 * the canvas edge and its label is clipped.
 */
function fitToViewport(nodes: Positioned[]): void {
  const xs = nodes.map(n => n.x ?? 0)
  const ys = nodes.map(n => n.y ?? 0)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const usableW = WIDTH - PAD_X * 2
  const usableH = HEIGHT - PAD_Y * 2
  const spanX = maxX - minX
  const spanY = maxY - minY

  // Never scale up: a two-node space should sit calmly in the middle rather
  // than being blown up to fill the canvas.
  const scale = Math.min(1, spanX > 0 ? usableW / spanX : 1, spanY > 0 ? usableH / spanY : 1)

  const centreX = (minX + maxX) / 2
  const centreY = (minY + maxY) / 2
  for (const node of nodes) {
    node.x = WIDTH / 2 + ((node.x ?? 0) - centreX) * scale
    node.y = HEIGHT / 2 + ((node.y ?? 0) - centreY) * scale
  }
}

interface KnowledgeMapProps {
  graph: SpaceGraph
  spaceId: string
}

export default function KnowledgeMap({ graph, spaceId }: KnowledgeMapProps) {
  const router = useRouter()
  const [showAll, setShowAll] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const model = useMemo(() => toMapModel(graph, showAll), [graph, showAll])
  const adjacency = useMemo(() => buildAdjacency(model.links), [model.links])

  // The layout is a pure function of the model, so it is computed, not stored in
  // state: d3-force runs to completion here and the settled positions are what
  // render. Ticking into state instead would re-render ~260 times to animate
  // something nobody asked to watch.
  const layout = useMemo(() => {
    if (model.nodes.length === 0) return null
    const nodes: Positioned[] = model.nodes.map(n => ({ ...n }))
    const links: PositionedLink[] = model.links.map(l => ({ ...l }))

    const simulation: Simulation<Positioned, PositionedLink> = forceSimulation(nodes)
      .force(
        'link',
        forceLink<Positioned, PositionedLink>(links)
          .id(d => d.id)
          // A heavier edge pulls its source and concept closer together.
          .distance(l => 130 - l.weight * 45)
          .strength(0.55)
      )
      .force('charge', forceManyBody().strength(-330))
      .force('center', forceCenter(WIDTH / 2, HEIGHT / 2))
      .force(
        'collide',
        forceCollide<Positioned>(d =>
          d.kind === 'concept' ? conceptRadius(d.degree) + 16 : SOURCE_RADIUS + 12
        )
      )
      .stop()

    // .stop() above means no timer is ever scheduled — tick() is synchronous,
    // so there is nothing to clean up.
    simulation.tick(SETTLE_TICKS)
    fitToViewport(nodes)
    return { nodes, links }
  }, [model])

  // --- pan & zoom (hand-rolled: d3-force is layout math only, no DOM) ---

  const onPointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }
    },
    [pan]
  )

  const onPointerMove = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag) return
    setPan({
      x: drag.panX + (event.clientX - drag.x),
      y: drag.panY + (event.clientY - drag.y),
    })
  }, [])

  const onPointerUp = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  const onWheel = useCallback((event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    setZoom(current => {
      const next = current * (event.deltaY < 0 ? 1.12 : 1 / 1.12)
      return Math.min(ZOOM_LIMITS.max, Math.max(ZOOM_LIMITS.min, next))
    })
  }, [])

  const resetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const isDimmed = useCallback(
    (id: string) => focused !== null && id !== focused && !adjacency.get(focused)?.has(id),
    [focused, adjacency]
  )

  if (model.nodes.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.et}>
          {graph.sources.length === 0 ? 'Nothing captured yet' : 'No connections yet'}
        </div>
        <p>
          {graph.sources.length === 0
            ? 'Capture a few sources into this space and the map will draw itself.'
            : 'Every concept here is mentioned by only one source. Capture more on overlapping subjects, or show all concepts below.'}
        </p>
        {graph.concepts.length > 0 ? (
          <button type="button" className={styles.maptoggle} onClick={() => setShowAll(true)}>
            Show all concepts
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={styles.mapwrap}>
      <div className={styles.mapbar}>
        {/* Identity is shape, not colour — every source node carries its kind's
            icon, so the map stays readable in greyscale and for CVD readers. */}
        <ul className={styles.maplegend}>
          {model.kinds.map(kind => (
            <li key={kind}>
              <span className={styles.maplegendicon} aria-hidden="true">
                <SourceIcon kind={kind} size={13} />
              </span>
              {KIND_LABEL[kind]}
            </li>
          ))}
          <li>
            <span className={styles.maplegendconcept} aria-hidden="true" />
            Concept
          </li>
        </ul>

        <div className={styles.mapactions}>
          {model.prunedCount > 0 || showAll ? (
            <button
              type="button"
              className={styles.maptoggle}
              onClick={() => setShowAll(v => !v)}
              aria-pressed={showAll}
            >
              {showAll
                ? 'Hide single-source concepts'
                : `Show all concepts (+${model.prunedCount})`}
            </button>
          ) : null}
          <button type="button" className={styles.maptoggle} onClick={resetView}>
            Reset view
          </button>
        </div>
      </div>

      <svg
        className={styles.mapcanvas}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Knowledge map: ${model.nodes.filter(n => n.kind === 'concept').length} concepts across ${model.nodes.filter(n => n.kind === 'source').length} sources. The concept list below the map is a text equivalent.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {layout?.links.map((link, i) => {
            const from = link.source as Positioned
            const to = link.target as Positioned
            const dim = isDimmed(from.id) && isDimmed(to.id)
            return (
              <line
                key={i}
                className={styles.mapedge}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                strokeOpacity={dim ? 0.06 : 0.15 + link.weight * 0.4}
              />
            )
          })}

          {layout?.nodes.map(node =>
            node.kind === 'concept' ? (
              <g
                key={node.id}
                className={`${styles.mapnode} ${isDimmed(node.id) ? styles.mapdim : ''}`}
                transform={`translate(${node.x} ${node.y})`}
                onMouseEnter={() => setFocused(node.id)}
                onMouseLeave={() => setFocused(null)}
                onFocus={() => setFocused(node.id)}
                onBlur={() => setFocused(null)}
                tabIndex={0}
                role="button"
                aria-label={`Concept ${node.label}, referenced by ${node.degree} ${node.degree === 1 ? 'source' : 'sources'}`}
              >
                <circle
                  r={conceptRadius(node.degree)}
                  className={node.isSpine ? styles.mapspine : styles.mapconcept}
                />
                {/* Labelled only when it carries structure or is being inspected —
                    labelling every node at once is what makes these unreadable. */}
                {node.degree >= 2 || focused === node.id ? (
                  <text
                    className={styles.mapconceptlabel}
                    y={conceptRadius(node.degree) + 14}
                    textAnchor="middle"
                  >
                    {node.label}
                  </text>
                ) : null}
              </g>
            ) : (
              <g
                key={node.id}
                className={`${styles.mapnode} ${styles.mapsourcenode} ${isDimmed(node.id) ? styles.mapdim : ''}`}
                transform={`translate(${node.x} ${node.y})`}
                onMouseEnter={() => setFocused(node.id)}
                onMouseLeave={() => setFocused(null)}
                onFocus={() => setFocused(node.id)}
                onBlur={() => setFocused(null)}
                onClick={() => router.push(`/dashboard/spaces/${spaceId}/sources/${node.id}`)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    router.push(`/dashboard/spaces/${spaceId}/sources/${node.id}`)
                  }
                }}
                tabIndex={0}
                role="link"
                aria-label={`${KIND_LABEL[node.sourceKind]}: ${node.title}`}
              >
                <circle r={SOURCE_RADIUS} className={styles.mapsourcedisc} />
                <g transform="translate(-6.5 -6.5)" className={styles.mapsourceicon}>
                  <SourceIcon kind={node.sourceKind} size={13} />
                </g>
                {focused === node.id ? (
                  <text className={styles.mapsourcelabel} y={SOURCE_RADIUS + 15} textAnchor="middle">
                    {node.title.length > 42 ? `${node.title.slice(0, 42)}…` : node.title}
                  </text>
                ) : null}
              </g>
            )
          )}
        </g>
      </svg>

      <p className={styles.maphint}>
        Drag to pan, scroll to zoom. Hover a node to isolate what it connects to; click a source
        to open it.
      </p>
    </div>
  )
}
