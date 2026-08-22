'use client'

/**
 * Text companion to the knowledge map: ranked concepts you can click to focus
 * the canvas. Spine (multi-source) concepts get a short featured strip; the
 * rest sit in a compact chip grid so the section doesn't read as a spreadsheet.
 */
import styles from './dashboard.module.css'
import type { ConceptNode } from '@/lib/graph'

interface ConceptListProps {
  concepts: ConceptNode[]
  maxDegree: number
  focusedConceptId?: string | null
  onFocusConcept?: (conceptId: string | null) => void
}

export default function ConceptList({
  concepts,
  maxDegree,
  focusedConceptId = null,
  onFocusConcept,
}: ConceptListProps) {
  if (concepts.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.et}>No concepts yet</div>
        <p>Concepts are pulled out of each capture automatically once it finishes processing.</p>
      </div>
    )
  }

  const spine = concepts.filter(c => c.degree >= 2)
  // If everything is degree 1, feature the top few so the section still has hierarchy.
  const featured =
    spine.length > 0 ? spine : concepts.slice(0, Math.min(3, concepts.length))
  const featuredIds = new Set(featured.map(c => c.id))
  const rest = concepts.filter(c => !featuredIds.has(c.id))

  const totalSourcesLinked = concepts.reduce((sum, c) => sum + c.degree, 0)

  const select = (id: string, selected: boolean) => {
    onFocusConcept?.(selected ? null : id)
  }

  return (
    <div className={styles.coverage}>
      <div className={styles.coverageSummary}>
        <span>
          <strong>{concepts.length}</strong>{' '}
          {concepts.length === 1 ? 'concept' : 'concepts'}
        </span>
        <span className={styles.coverageDot} aria-hidden="true" />
        <span>
          Strongest link · <em>{featured[0]?.label}</em>
        </span>
        <span className={styles.coverageDot} aria-hidden="true" />
        <span>
          {totalSourcesLinked} source links
        </span>
      </div>

      {featured.length > 0 ? (
        <div className={styles.coverageSpine}>
          <div className={styles.coverageSecLabel}>
            <span className={styles.coverageSecNum}>Spine</span>
            <span>
              {spine.length > 0
                ? 'Concepts that connect more than one source'
                : 'Top concepts in this space'}
            </span>
          </div>
          <div className={styles.coverageFeatured}>
            {featured.map((concept, index) => {
              const selected = focusedConceptId === concept.id
              const pct =
                maxDegree > 0 ? Math.round((concept.degree / maxDegree) * 100) : 0
              return (
                <button
                  key={concept.id}
                  type="button"
                  className={`${styles.coverageCard} ${selected ? styles.coverageCardOn : ''}`}
                  onClick={() => select(concept.id, selected)}
                  aria-pressed={selected}
                >
                  <div className={styles.coverageCardTop}>
                    <span className={styles.coverageRank}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={
                        concept.degree >= maxDegree
                          ? styles.coverageBadgeSpine
                          : styles.coverageBadge
                      }
                    >
                      {concept.degree}
                      <span>
                        {concept.degree === 1 ? ' source' : ' sources'}
                      </span>
                    </span>
                  </div>
                  <div className={styles.coverageCardTitle}>{concept.label}</div>
                  <div className={styles.coverageMeter} aria-hidden="true">
                    <span
                      className={
                        concept.degree >= maxDegree
                          ? styles.coverageMeterFillSpine
                          : styles.coverageMeterFill
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={styles.coverageCardHint}>
                    {selected ? 'Showing on map · click to clear' : 'Click to focus on map'}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {rest.length > 0 ? (
        <div className={styles.coverageAlso}>
          <div className={styles.coverageSecLabel}>
            <span className={styles.coverageSecNum}>Also covered</span>
            <span>Single-source concepts — still part of the picture</span>
          </div>
          <ul className={styles.coverageChips}>
            {rest.map(concept => {
              const selected = focusedConceptId === concept.id
              return (
                <li key={concept.id}>
                  <button
                    type="button"
                    className={`${styles.coverageChip} ${selected ? styles.coverageChipOn : ''}`}
                    onClick={() => select(concept.id, selected)}
                    aria-pressed={selected}
                  >
                    <span className={styles.coverageChipLabel}>{concept.label}</span>
                    <span className={styles.coverageChipCount}>{concept.degree}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
