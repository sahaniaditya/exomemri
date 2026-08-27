import styles from './marketing.module.css';

export function Solution() {
  return (
    <div className={`${styles.sec} ${styles.divide}`} id="solution">
      <div className={styles.wrap}>
        <div className={styles.plate}>
          <span className={styles.platenum}>03</span>
          <span className={styles.label}>The solution</span>
          <span className={styles.plateline} />
        </div>
        <div className={styles.solutionGrid}>
          <div className={styles.solutionSticky}>
            <h2 className={`${styles.serif} ${styles.solutionTitle}`}>
              One workspace for
              <br />
              everything you learn.
            </h2>
            <p className={`${styles.dim} ${styles.solutionCopy}`}>
              exomemri isn&apos;t another notebook. It&apos;s a learning memory
              that captures, understands, and connects everything you study
              — automatically.
            </p>
            <p className={`${styles.dim} ${styles.solutionCopyLast}`}>
              Instead of scattered saves, you get one{' '}
              <span className={`${styles.accent} font-semibold`}>Learning Space</span>{' '}
              per topic. Every source flows into it automatically. Then AI
              works across all of it at once.
            </p>
            <p className={styles.solutionPull}>
              It&apos;s the difference between a folder of files and a
              brain that actually remembers.
            </p>
          </div>
          <div className={`${styles.card} ${styles.solutionCard}`}>
            <div className={styles.label}>Ask your own knowledge</div>
            <div className={styles.solutionBubbles}>
              <div className={`${styles.bubble} ${styles.bubbleCueGreen}`}>
                &quot;Explain photosynthesis based on everything I&apos;ve studied.&quot;
              </div>
              <div className={`${styles.bubble} ${styles.bubbleCueClay}`}>
                &quot;What concepts have I not covered yet?&quot;
              </div>
              <div className={`${styles.bubble} ${styles.bubbleCueGreen}`}>
                &quot;Summarize only what I highlighted.&quot;
              </div>
            </div>
            <div className={styles.solutionChips}>
              <span className={styles.chip}>🎬 videos</span>
              <span className={styles.chip}>📰 articles</span>
              <span className={styles.chip}>✦ AI chats</span>
              <span className={styles.chip}>◆ PDFs</span>
              <span className={styles.chip}>✎ your notes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
