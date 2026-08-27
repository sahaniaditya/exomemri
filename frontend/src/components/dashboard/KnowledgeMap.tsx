'use client'

/**
 * Knowledge map chrome: legend, prune toggle, reset, empty states.
 * The canvas itself lives in KnowledgeMapCanvas and is loaded with ssr:false.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { ForceGraphMethods } from 'react-force-graph-2d'
import styles from './dashboard.module.css'
import SourceIcon from './SourceIcon'
import { toMapModel, type SpaceGraph } from '@/lib/graph'
import type { SourceKind } from '@/lib/dashboard-data'
import type { GraphNode } from './KnowledgeMapCanvas'

const KnowledgeMapCanvas = dynamic(() => import('./KnowledgeMapCanvas'), {
  ssr: false,
  loading: () => <div className={styles.maploading}>Loading map…</div>,
})

const KIND_LABEL: Record<SourceKind, string> = {
  video: 'Video',
  article: 'Article',
  chat: 'AI chat',
  pdf: 'PDF',
  note: 'Note',
}

interface KnowledgeMapProps {
  graph: SpaceGraph
  spaceId: string
  focusedConceptId?: string | null
  onFocusConcept?: (conceptId: string | null) => void
}

export default function KnowledgeMap({
  graph,
  spaceId,
  focusedConceptId = null,
  onFocusConcept,
}: KnowledgeMapProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<ForceGraphMethods<GraphNode> | undefined>(undefined)
  const [showAll, setShowAll] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [size, setSize] = useState({ width: 900, height: 520 })

  const model = useMemo(() => toMapModel(graph, showAll), [graph, showAll])
  const focused = focusedConceptId ?? hoveredId
  const stickyFocus = focusedConceptId !== null
  const graphKey = `${model.nodes.length}:${model.links.length}:${showAll}`

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const apply = () => {
      const rect = el.getBoundingClientRect()
      setSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(360, Math.floor(rect.height)),
      })
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const setFocus = useCallback(
    (id: string | null) => {
      onFocusConcept?.(id)
    },
    [onFocusConcept]
  )

  const resetView = useCallback(() => {
    fgRef.current?.zoomToFit(400, 48)
  }, [])

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
          <li>
            <span className={styles.maplegendspine} aria-hidden="true" />
            Spine
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

      <div
        ref={wrapRef}
        className={styles.mapcanvas}
        role="img"
        aria-label={`Knowledge map: ${model.nodes.filter(n => n.kind === 'concept').length} concepts across ${model.nodes.filter(n => n.kind === 'source').length} sources. The concept list below the map is a text equivalent.`}
      >
        <KnowledgeMapCanvas
          model={model}
          spaceId={spaceId}
          width={size.width}
          height={size.height}
          focused={focused}
          stickyFocus={stickyFocus}
          onHoverId={setHoveredId}
          onFocusConcept={setFocus}
          graphKey={graphKey}
          fgRef={fgRef}
        />
      </div>

      <p className={styles.maphint}>
        Drag nodes to rearrange · scroll to zoom · pan the canvas. Click a concept to isolate it;
        click a source to open it.
      </p>
    </div>
  )
}
