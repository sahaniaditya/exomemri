import styles from './marketing.module.css';

export function Problem() {
  return (
    <div className={`${styles.sec} ${styles.divide}`} id="problem">
      <div className={styles.wrap}>
        <div className={styles.plate}>
          <span className={styles.platenum}>02</span>
          <span className={styles.label}>The problem</span>
          <span className={styles.plateline} />
        </div>
        <div className={styles.problemGrid}>
          <div>
            <h2 className={`${styles.serif} ${styles.problemTitle}`}>
              The pain every
              <br />
              self-learner knows.
            </h2>
            <p className={`${styles.dim} ${styles.problemCopy}`}>
              You learn from everywhere now — YouTube, blogs, docs, ChatGPT,
              PDFs. But your learning is scattered across a dozen tabs and
              tools, and three days later it&apos;s gone.
            </p>
            <p className={`${styles.dim} ${styles.problemCopy} ${styles.problemCopyFlush}`}>
              You watch five videos, read three articles, have ten AI
              conversations, skim the docs. Then a week later, it&apos;s
              all just… somewhere.
            </p>
            <p className={styles.problemLead}>
              It was never about taking notes. It&apos;s about learning
              across fragmented sources and actually remembering it. Note
              apps give you another empty page.{' '}
              <span className={`${styles.accent} font-semibold`}>What you need is memory.</span>
            </p>
          </div>
          <div className={styles.problemTabs}>
            <div className={`${styles.tab} ${styles.tab1}`}>
              <span className={`${styles.srcico} ${styles.srcicoSm} ${styles.srcicoVideo}`}>▶</span>
              17 open tabs
            </div>
            <div className={`${styles.tab} ${styles.tab2}`}>
              <span className={`${styles.srcico} ${styles.srcicoSm} ${styles.srcicoDoc}`}>◆</span>
              bookmarks_untitled
            </div>
            <div className={`${styles.tab} ${styles.tab3}`}>
              <span className={`${styles.srcico} ${styles.srcicoSm} ${styles.srcicoAi}`}>✦</span>
              ChatGPT history
            </div>
            <div className={`${styles.tab} ${styles.tab4}`}>
              📄 notes-final-v3.md
            </div>
            <div className={`${styles.tab} ${styles.tabAccent} ${styles.tab5}`}>
              <span className={`${styles.pull} ${styles.pullSm} ${styles.clay}`}>&quot;…where was it?&quot;</span>
            </div>
          </div>
        </div>
        <div className={styles.problemQuoteBlock}>
          <p className={`${styles.pull} ${styles.problemQuote}`}>
            <span className={styles.clay}>&quot;</span>There was a great explanation of how plants make food from sunlight…{' '}
            <span className={styles.dim}>where was it?</span>
            <span className={styles.clay}>&quot;</span>
          </p>
        </div>
      </div>
    </div>
  );
}
