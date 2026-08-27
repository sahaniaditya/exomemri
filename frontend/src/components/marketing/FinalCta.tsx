import { Contour } from './Contour';
import styles from './marketing.module.css';

export function FinalCta() {
  return (
    <div className={styles.sec} id="cta">
      <div className={styles.wrap}>
        <div className={`${styles.ctaband} ${styles.ctabandInner}`}>
          <Contour invert />
          <div className={styles.ctabandContent}>
            <span className={`${styles.label} ${styles.labelInvert}`}>Section 12 · get started</span>
            <h2 className={`${styles.serif} ${styles.ctaTitle}`}>
              Turn everything you learn
              <br />
              <span className={`${styles.it} ${styles.ctaTitleAccent}`}>into memory.</span>
            </h2>
            <p className={styles.ctaBody}>
              Stop losing what you study. Start building a learning memory
              that grows with you — your first Learning Space in minutes.
            </p>
            <div className={styles.finalCtas}>
              <a href="/signup" className={`${styles.btn} ${styles.btnP} ${styles.btnPInvert}`}>
                Get started free <span className={styles.arrow}>→</span>
              </a>
              <a href="/login" className={`${styles.btn} ${styles.btnG} ${styles.btnGInvert}`}>
                Log in
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
