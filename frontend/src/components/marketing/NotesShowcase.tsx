import styles from './marketing.module.css';

export function NotesShowcase() {
  return (
    <div className={`${styles.sec} ${styles.divide}`} id="notes">
      <div className={styles.wrap}>
        <div className={styles.plate}>
          <span className={styles.platenum}>06</span>
          <span className={styles.label}>Your notes</span>
          <span className={styles.plateline} />
        </div>
        <div className={styles.showcaseGrid}>
          <div className={styles.notesMock}>
            <div className={styles.winBar}>
              <span className={`${styles.tl} ${styles.tlAmber}`} />
              <span className={`${styles.tl} ${styles.tlSage}`} />
              <span className={`${styles.tl} ${styles.tlClay}`} />
              <span className={styles.mono}>Crash Course · Photosynthesis</span>
            </div>
            <div className={styles.notesTabs}>
              <span className={styles.notesTab}>Summary</span>
              <span className={`${styles.notesTab} ${styles.notesTabActive}`}>Your notes</span>
              <span className={styles.notesTab}>Chat</span>
            </div>
            <div className={styles.notesBody}>
              <div className={styles.notesPageTitle}>Light vs dark reactions</div>
              <p className={styles.notesLine}>
                Light reactions happen in the thylakoid membrane — they capture
                energy from sunlight and make ATP + NADPH.
              </p>
              <p className={styles.notesLine}>
                Dark reactions (Calvin cycle) use that energy to build sugar
                from CO₂. They don&apos;t need light directly, but they need
                the products of the light reactions.
              </p>
              <p className={`${styles.notesLine} ${styles.notesLineMuted}`}>
                Reminder: chloroplast = where all of this lives inside the plant cell.
              </p>
            </div>
          </div>
          <div>
            <h2 className={`${styles.serif} ${styles.showcaseTitle}`}>
              Write your own words
              <br />
              <span className={`${styles.it} ${styles.accent}`}>next to the source.</span>
            </h2>
            <p className={`${styles.dim} ${styles.showcaseCopy}`}>
              On every capture, add named note pages — jot what you want to
              remember, link ideas, and paste images beside the video or
              article that sparked them.
            </p>
            <p className={`${styles.dim} ${styles.showcaseCopy}`}>
              Notes live with the source inside your Learning Space. Not a
              blank notebook competing with your memory — an annotation layer
              when you want your own voice in the mix.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
