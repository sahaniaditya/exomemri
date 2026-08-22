'use client'
import styles from './dashboard.module.css'
import type { ConceptNode } from '@/lib/graph'

interface ConceptListProps {
  concepts: ConceptNode[]
  /** Highest degree in the space, so the bars share one scale. */
  maxDegree: number
}

/**
 * The map's text equivalent: concepts ranked by how many sources cover them.
 * Deliberately always present — a node-link view stops being legible past a few
 * hundred nodes, and this list never does. It is also the accessible reading of
 * the same data for anyone who can't use the canvas.
 */
export default function ConceptList({ concepts, maxDegree }: ConceptListProps) {
  if (concepts.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.et}>No concepts yet</div>
        <p>Concepts are pulled out of each capture automatically once it finishes processing.</p>
      </div>
    )
  }

  return (
    <ol className={styles.conceptlist}>
      {concepts.map(concept => (
        <li key={concept.id} className={styles.conceptrow}>
          <span className={styles.conceptlabel}>{concept.label}</span>
          <span className={styles.conceptbar} aria-hidden="true">
            <span
              className={concept.degree >= maxDegree ? styles.conceptfillspine : styles.conceptfill}
              style={{ width: `${maxDegree > 0 ? (concept.degree / maxDegree) * 100 : 0}%` }}
            />
          </span>
          <span className={styles.conceptcount}>
            {concept.degree}
            <span className={styles.conceptcountunit}>
              {concept.degree === 1 ? ' source' : ' sources'}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}
