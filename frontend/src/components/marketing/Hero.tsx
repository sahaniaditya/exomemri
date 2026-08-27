'use client';
import { Contour } from './Contour';
import { FULL_ANSWER } from './data';
import { useTypewriter } from './useTypewriter';
import styles from './marketing.module.css';

export function Hero() {
  const { typed, done } = useTypewriter(FULL_ANSWER);
  return (
    <div id="top" className={styles.hero}>
      <Contour />
      <span className={`${styles.coord} ${styles.coordTopRight}`}>40.7128° N · 74.0060° W</span>
      <div className={`${styles.wrap} ${styles.heroContent}`}>
        <div className={styles.heroGrid}>
          <div>
            <div className={`${styles.chip} ${styles.chipHero} ${styles.mono}`}>
              <span className={`${styles.dot} ${styles.dotForest}`} />
              Your AI learning memory
            </div>
            <h1 className={`${styles.serif} ${styles.h1}`}>
              Never lose anything
              <br />
              you learn online <span className={`${styles.it} ${styles.accent}`}>again.</span>
            </h1>
            <p className={`${styles.dim} ${styles.heroIntro}`}>
              exomemri captures every video, article, and AI chat you learn from,
              understands it, and remembers it for you — so you can recall or
              connect anything, instantly.
            </p>
            <div className={styles.heroCtas}>
              <a href="/signup" className={`${styles.btn} ${styles.btnP}`}>
                Start building your learning memory — free <span className={styles.arrow}>→</span>
              </a>
              <a href="/login" className={`${styles.btn} ${styles.btnG}`}>
                Log in
              </a>
            </div>
            <p className={`${styles.mono} ${styles.heroNote}`}>
              Works right inside your browser · Save with one click · No copy-paste, ever.
            </p>
          </div>
          <div className={styles.floaty}>
            <div className={styles.card}>
              <div className={styles.winBar}>
                <span className={`${styles.tl} ${styles.tlAmber}`} />
                <span className={`${styles.tl} ${styles.tlSage}`} />
                <span className={`${styles.tl} ${styles.tlClay}`} />
                <span className={styles.mono}>Learning Space · Biology</span>
              </div>
              <div className={styles.heroCardBody}>
                <div className={`${styles.label} ${styles.heroCardLabel}`}>3 sources merged</div>
                <div className={styles.srcList}>
                  <div className={styles.srcrow}>
                    <span className={`${styles.srcico} ${styles.srcicoSm} ${styles.srcicoVideo}`}>▶</span>
                    <div className={styles.srcGrow}>
                      <div className={styles.srcrowTitle}>Crash Course · Photosynthesis</div>
                      <div className={`${styles.mono} ${styles.srcrowMeta}`}>YouTube · 12:48</div>
                    </div>
                    <span className={`${styles.chip} ${styles.chipSm}`}>summarized</span>
                  </div>
                  <div className={styles.srcrow}>
                    <span className={`${styles.srcico} ${styles.srcicoSm} ${styles.srcicoDoc}`}>◆</span>
                    <div className={styles.srcGrow}>
                      <div className={styles.srcrowTitle}>Chloroplasts explained</div>
                      <div className={`${styles.mono} ${styles.srcrowMeta}`}>Article · 8 min</div>
                    </div>
                    <span className={`${styles.chip} ${styles.chipSm}`}>summarized</span>
                  </div>
                  <div className={styles.srcrow}>
                    <span className={`${styles.srcico} ${styles.srcicoSm} ${styles.srcicoAi}`}>✦</span>
                    <div className={styles.srcGrow}>
                      <div className={styles.srcrowTitle}>ChatGPT · light vs dark reactions</div>
                      <div className={`${styles.mono} ${styles.srcrowMeta}`}>AI chat · 18 msgs</div>
                    </div>
                    <span className={`${styles.chip} ${styles.chipSm}`}>summarized</span>
                  </div>
                </div>
                <div className={styles.chatStack}>
                  <div className={`${styles.bubble} ${styles.qbubble}`}>
                    Explain photosynthesis based on everything I&apos;ve studied.
                  </div>
                  <div className={styles.bubble}>
                    <span>{typed}</span>
                    <span className={`${styles.caret}${done ? ` ${styles.caretHidden}` : ''}`} />
                    <div className={`${styles.heroCitations}${done ? '' : ` ${styles.citationsHidden}`}`}>
                      <span className={styles.cite}>▶ 4:12 in video</span>
                      <span className={styles.cite}>◆ article · chloroplasts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <span className={`${styles.coord} ${styles.coordBottomLeft}`}>plate 01 · recall</span>
          </div>
        </div>
      </div>
    </div>
  );
}
