import { STEPS } from './data';
import styles from './marketing.module.css';

export function HowItWorks() {
  return (
    <div className={`${styles.sec} ${styles.divide}`} id="how">
      <div className={styles.wrap}>
        <div className={styles.plate}>
          <span className={styles.platenum}>04</span>
          <span className={styles.label}>How it works</span>
          <span className={styles.plateline} />
        </div>
        <h2 className={`${styles.serif} ${styles.howTitle}`}>Three steps, zero friction.</h2>
        <div className={styles.stepsGrid}>
          {STEPS.map((s, i) => (
            <div key={s.n} className={styles.step}>
              <div className={`${styles.stepbar}${i === STEPS.length - 1 ? ` ${styles.stepbarLast}` : ''}`} />
              <div className={styles.stepnum}>{s.n}</div>
              <h3 className={`${styles.serif} ${styles.stepTitle}`}>{s.title}</h3>
              <p className={styles.dim}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
