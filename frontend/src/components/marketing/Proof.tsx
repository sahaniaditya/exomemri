import type { PublicReview } from '@/lib/reviews'
import styles from './marketing.module.css'

const PLACEHOLDER_TESTIMONIALS = [
  "I stopped re-watching videos I'd already seen. It just tells me what's new.",
  "It's the first tool that actually remembers what I've learned, not just what I saved.",
]

function StarRow({ rating }: { rating: number }) {
  return (
    <div className={styles.proofStars} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(value => (
        <span
          key={value}
          className={value <= rating ? styles.proofStarOn : styles.proofStarOff}
          aria-hidden="true"
        >
          ★
        </span>
      ))}
    </div>
  )
}

export function Proof({ reviews = [] }: { reviews?: PublicReview[] }) {
  const hasReviews = reviews.length > 0

  return (
    <div className={`${styles.sec} ${styles.divide}`} id="proof">
      <div className={styles.wrap}>
        <div className={styles.plate}>
          <span className={styles.platenum}>10</span>
          <span className={styles.label}>In their words</span>
          <span className={styles.plateline} />
        </div>
        <div className={styles.proofGrid}>
          {hasReviews
            ? reviews.map(review => {
                const initial = (review.full_name.trim()[0] || '?').toUpperCase()
                return (
                  <div
                    key={`${review.full_name}-${review.body.slice(0, 24)}`}
                    className={`${styles.card} ${styles.proofCard}`}
                  >
                    <p className={styles.quote}>&quot;{review.body}&quot;</p>
                    <div className={styles.proofAttribution}>
                      <div className={`${styles.mono} ${styles.dim} ${styles.proofAvatar}`}>
                        {initial}
                      </div>
                      <div>
                        <div className={styles.proofName}>{review.full_name}</div>
                        <div className={`${styles.mono} ${styles.proofRole}`}>
                          {review.primary_role}
                        </div>
                        <StarRow rating={review.rating} />
                      </div>
                    </div>
                  </div>
                )
              })
            : PLACEHOLDER_TESTIMONIALS.map(quote => (
                <div key={quote} className={`${styles.card} ${styles.proofCard}`}>
                  <p className={styles.quote}>&quot;{quote}&quot;</p>
                  <div className={styles.proofAttribution}>
                    <div className={`${styles.mono} ${styles.dim} ${styles.proofAvatar}`}>?</div>
                    <div>
                      <div className={styles.proofName}>[Name]</div>
                      <div className={`${styles.mono} ${styles.proofRole}`}>[role]</div>
                    </div>
                  </div>
                </div>
              ))}
        </div>
        {!hasReviews && (
          <p className={`${styles.mono} ${styles.proofNote}`}>
            Placeholder testimonials — swap in real quotes as you gather them.
          </p>
        )}
      </div>
    </div>
  )
}
