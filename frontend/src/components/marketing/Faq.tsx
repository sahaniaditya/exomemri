import { FAQS } from './data';
import styles from './marketing.module.css';

export function Faq() {
  return (
    <div className={`${styles.sec} ${styles.divide}`} id="faq">
      <div className={`${styles.wrap} ${styles.wrapNarrow}`}>
        <div className={styles.plate}>
          <span className={styles.platenum}>11</span>
          <span className={styles.label}>FAQ</span>
          <span className={styles.plateline} />
        </div>
        <h2 className={`${styles.serif} ${styles.faqTitle}`}>Questions people will ask.</h2>
        <div className={styles.faq}>
          {FAQS.map((f, i) => (
            <details
              key={f.q}
              open={f.open}
              className={i === FAQS.length - 1 ? styles.faqLast : undefined}
            >
              <summary>
                {f.q}
                <span className={styles.plus}>+</span>
              </summary>
              <p className={styles.ans}>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
