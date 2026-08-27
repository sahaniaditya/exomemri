import { AUDIENCE } from './data';
import styles from './marketing.module.css';

export function Audience() {
  return (
    <div className={`${styles.sec} ${styles.divide}`} id="who">
      <div className={styles.wrap}>
        <div className={styles.plate}>
          <span className={styles.platenum}>09</span>
          <span className={styles.label}>Who it&apos;s for</span>
          <span className={styles.plateline} />
        </div>
        <h2 className={`${styles.serif} ${styles.audienceTitle}`}>Built for people who learn online.</h2>
        <div className={styles.audienceGrid}>
          {AUDIENCE.map((a) => (
            <div key={a.title} className={styles.acard}>
              <div className={styles.ficon}>{a.icon}</div>
              <h3 className={styles.serif}>{a.title}</h3>
              <p className={styles.dim}>{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
