import styles from './marketing.module.css';

export function WhyDifferent() {
  return (
    <div className={`${styles.sec} ${styles.divide}`} id="why">
      <div className={styles.wrap}>
        <div className={styles.plate}>
          <span className={styles.platenum}>08</span>
          <span className={styles.label}>Why it&apos;s different</span>
          <span className={styles.plateline} />
        </div>
        <h2 className={`${styles.serif} ${styles.whyTitle}`}>
          Not a note app. <span className={`${styles.it} ${styles.accent}`}>A memory.</span>
        </h2>
        <p className={`${styles.dim} ${styles.whyIntro}`}>
          Other tools help you save information. exomemri helps you remember
          it — and understand it over time. Your own notes still belong on
          each capture when you want them.
        </p>
        <div className={styles.crow}>
          <div className={styles.ccol}>
            <div className={`${styles.label} ${styles.clay} ${styles.ccolLabel}`}>Most tools</div>
            <h3 className={`${styles.serif} ${styles.ccolTitle}`}>Store &amp; search.</h3>
            <div className={styles.cli}><span className={styles.dim}>○</span><span className={styles.dim}>Give you somewhere to put things</span></div>
            <div className={styles.cli}><span className={styles.dim}>○</span><span className={styles.dim}>A folder of files you have to organize</span></div>
            <div className={styles.cli}><span className={styles.dim}>○</span><span className={styles.dim}>Built around a single document</span></div>
            <div className={styles.cli}><span className={styles.dim}>○</span><span className={styles.dim}>Remembers what you saved</span></div>
          </div>
          <div className={`${styles.ccol} ${styles.ccolAccent}`}>
            <div className={`${styles.label} ${styles.accent} ${styles.ccolLabel}`}>exomemri</div>
            <h3 className={`${styles.serif} ${styles.accent} ${styles.ccolTitle}`}>Understand &amp; remember.</h3>
            <div className={`${styles.cli} ${styles.cliAccent}`}><span className={styles.accent}>●</span><span>Understands what you&apos;ve learned</span></div>
            <div className={`${styles.cli} ${styles.cliAccent}`}><span className={styles.accent}>●</span><span>Connects learning across every source</span></div>
            <div className={`${styles.cli} ${styles.cliAccent}`}><span className={styles.accent}>●</span><span>Tracks what you actually know</span></div>
            <div className={`${styles.cli} ${styles.cliAccent}`}><span className={styles.accent}>●</span><span>Built for learning over months, not minutes</span></div>
          </div>
        </div>
        <p className={styles.whyClosing}>
          The promise isn&apos;t &quot;take notes while you learn.&quot; It&apos;s:{' '}
          <span className={`${styles.it} ${styles.accent}`}>never lose anything you learn online again</span>{' '}
          — and instantly recall or connect it whenever you need.
        </p>
      </div>
    </div>
  );
}
