import { FEATURES_MAIN } from './data';
import styles from './marketing.module.css';

export function Features() {
  return (
    <div className={`${styles.sec} ${styles.divide}`} id="features">
      <div className={styles.wrap}>
        <div className={styles.plate}>
          <span className={styles.platenum}>07</span>
          <span className={styles.label}>Core features</span>
          <span className={styles.plateline} />
        </div>
        <div className={styles.featuresHead}>
          <h2 className={`${styles.serif} ${styles.featuresTitle}`}>What exomemri does for you.</h2>
          <p className={`${styles.dim} ${styles.featuresIntro}`}>
            Every feature exists to make studying smooth: effortless to
            save, impossible to lose, and built to make things actually
            stick.
          </p>
        </div>
        <div className={styles.fgrid}>
          {FEATURES_MAIN.map((f) => (
            <div key={f.n} className={styles.fcell}>
              <div className={styles.fnum}>{f.n}</div>
              <h3 className={styles.ft}>{f.title}</h3>
              <p className={styles.dim}>{f.body}</p>
            </div>
          ))}
        </div>
        <div className={styles.featureSecondaryGrid}>
          <div className={`${styles.card} ${styles.cardFlush}`}>
            <div className={styles.winBar}>
              <span className={`${styles.tl} ${styles.tlAmber}`} />
              <span className={`${styles.tl} ${styles.tlSage}`} />
              <span className={`${styles.tl} ${styles.tlClay}`} />
              <span className={styles.mono}>youtube.com · Photosynthesis</span>
            </div>
            <div className={styles.featureMediaRow}>
              <div className={styles.featureMediaMain}>
                <div className={styles.skeletonLine} />
                <div className={styles.videoPlaceholder}>▶ video</div>
              </div>
              <div className={styles.featureMediaSide}>
                <div className={`${styles.label} ${styles.labelSm}`}>exomemri · while you browse</div>
                <div className={styles.ringWrap}>
                  <svg width="112" height="112" viewBox="0 0 112 112">
                    <circle className={styles.ringTrack} cx="56" cy="56" r="50" />
                    <circle className={styles.ringVal} cx="56" cy="56" r="50" />
                    <text x="56" y="52" textAnchor="middle" fontFamily="var(--font-marketing-serif), Georgia, serif" fontSize="30" className={styles.ringFill}>70%</text>
                    <text x="56" y="70" textAnchor="middle" fontFamily="var(--font-marketing-mono), monospace" fontSize="9" letterSpacing="1" className={styles.ringLabel}>KNOWN</text>
                  </svg>
                </div>
                <p className={styles.mediaCaption}>
                  You already know 70% of this — here&apos;s the{' '}
                  <span className={`${styles.accent} font-semibold`}>30% that&apos;s new.</span>
                </p>
              </div>
            </div>
          </div>
          <div className={styles.featureSecondaryCol}>
            <div className={`${styles.fcell} ${styles.fcellFlush}`}>
              <div className={styles.fnum}>F7</div>
              <h3 className={`${styles.ft} ${styles.ftSm}`}>Learn while you browse</h3>
              <p className={styles.dim}>
                Open a new video and exomemri already knows what you&apos;ve
                studied. A side panel tells you what&apos;s new, so you
                never waste time relearning what you&apos;ve covered.
              </p>
            </div>
            <div className={`${styles.fcell} ${styles.fcellFlush}`}>
              <div className={styles.fnum}>F8</div>
              <h3 className={`${styles.ft} ${styles.ftSm}`}>Review that makes it stick</h3>
              <p className={styles.dim}>
                Quizzes, flashcards, and spaced repetition from your own
                material — weighted toward your weakest concepts, surfaced
                right before you&apos;d forget them.
              </p>
            </div>
          </div>
        </div>
        <div className={`${styles.fgrid} ${styles.fgridMt}`}>
          <div className={styles.fcell}>
            <div className={styles.fnum}>F9</div>
            <h3 className={styles.ft}>Pick up where you left off</h3>
            <p className={styles.dim}>
              Open your browser tomorrow and see exactly where you were:
              what you watched, read, and asked — with a single
              &quot;continue&quot; to jump back in. No more &quot;where was
              I?&quot;
            </p>
          </div>
          <div className={styles.fcell}>
            <div className={styles.fnum}>F10</div>
            <h3 className={styles.ft}>Your learning timeline</h3>
            <p className={styles.dim}>
              Replay how you learned any topic over days or weeks — the
              videos, the articles, the questions, the breakthroughs. Your
              entire learning journey, in one place.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
