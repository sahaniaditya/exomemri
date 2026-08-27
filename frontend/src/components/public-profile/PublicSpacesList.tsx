import CoverageRing from '@/components/dashboard/CoverageRing'
import type { PublicSpaceSummary } from '@/lib/public-profile'
import styles from './public-profile.module.css'

/** Horizontal portfolio rows — name + source count, coverage on the right. */
export default function PublicSpacesList({ spaces }: { spaces: PublicSpaceSummary[] }) {
  return (
    <ul className={styles.spaceList}>
      {spaces.map((space, index) => (
        <li
          key={`${space.name}-${index}`}
          className={styles.spaceRow}
          style={{ animationDelay: `${0.12 + index * 0.04}s` }}
        >
          <span className={styles.spaceAccent} aria-hidden="true" />
          <div className={styles.spaceCopy}>
            <h3 className={styles.spaceTitle}>{space.name}</h3>
            <p className={styles.spaceMeta}>
              {space.source_count}{' '}
              {space.source_count === 1 ? 'source' : 'sources'}
            </p>
          </div>
          {space.coverage_pct !== null && (
            <div className={styles.spaceRing}>
              <CoverageRing pct={space.coverage_pct} />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
