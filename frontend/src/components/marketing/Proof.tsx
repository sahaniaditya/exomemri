import styles from './marketing.module.css';

const TESTIMONIALS = [
  "I stopped re-watching videos I'd already seen. It just tells me what's new.",
  "It's the first tool that actually remembers what I've learned, not just what I saved.",
];

export function Proof() {
  return (
    <div className={`${styles.sec} ${styles.divide}`} id="proof">
      <div className={styles.wrap}>
        <div className={styles.plate}>
          <span className={styles.platenum}>10</span>
          <span className={styles.label}>In their words</span>
          <span className={styles.plateline} />
        </div>
        <div className={styles.proofGrid}>
          {TESTIMONIALS.map((quote) => (
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
        <p className={`${styles.mono} ${styles.proofNote}`}>
          Placeholder testimonials — swap in real quotes as you gather them.
        </p>
      </div>
    </div>
  );
}
