import { FEATURES_MAIN } from './data';

export function Features() {
  return (
    <div className="sec divide" id="features">
      <div className="wrap">
        <div className="plate">
          <span className="platenum">05</span>
          <span className="label">Core features</span>
          <span className="plateline" />
        </div>
        <div className="features-head">
          <h2 className="serif features-title">What exomemri does for you.</h2>
          <p className="dim features-intro">
            Every feature exists to make studying smooth: effortless to
            save, impossible to lose, and built to make things actually
            stick.
          </p>
        </div>
        <div className="fgrid">
          {FEATURES_MAIN.map((f) => (
            <div key={f.n} className="fcell">
              <div className="fnum">{f.n}</div>
              <h3 className="ft">{f.title}</h3>
              <p className="dim">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="feature-secondary-grid">
          <div className="card card-flush">
            <div className="win-bar">
              <span className="tl tl-amber" />
              <span className="tl tl-sage" />
              <span className="tl tl-clay" />
              <span className="mono">youtube.com · Kafka Internals</span>
            </div>
            <div className="feature-media-row">
              <div className="feature-media-main">
                <div className="skeleton-line" />
                <div className="video-placeholder">▶ video</div>
              </div>
              <div className="feature-media-side">
                <div className="label label-sm">exomemri · while you browse</div>
                <div className="ring-wrap">
                  <svg width="112" height="112" viewBox="0 0 112 112">
                    <circle className="ring-track" cx="56" cy="56" r="50" />
                    <circle className="ring-val" cx="56" cy="56" r="50" />
                    <text x="56" y="52" textAnchor="middle" fontFamily="Newsreader" fontSize="30" fill="#1B1A16">70%</text>
                    <text x="56" y="70" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#7C8A7E" letterSpacing="1">KNOWN</text>
                  </svg>
                </div>
                <p className="media-caption">
                  You already know 70% of this — here&apos;s the{' '}
                  <span className="accent font-semibold">30% that&apos;s new.</span>
                </p>
              </div>
            </div>
          </div>
          <div className="feature-secondary-col">
            <div className="fcell fcell-flush">
              <div className="fnum">F7</div>
              <h3 className="ft ft-sm">Learn while you browse</h3>
              <p className="dim">
                Open a new video and exomemri already knows what you&apos;ve
                studied. A side panel tells you what&apos;s new, so you
                never waste time relearning what you&apos;ve covered.
              </p>
            </div>
            <div className="fcell fcell-flush">
              <div className="fnum">F8</div>
              <h3 className="ft ft-sm">Review that makes it stick</h3>
              <p className="dim">
                Quizzes, flashcards, and spaced repetition from your own
                material — weighted toward your weakest concepts, surfaced
                right before you&apos;d forget them.
              </p>
            </div>
          </div>
        </div>
        <div className="fgrid fgrid-mt">
          <div className="fcell">
            <div className="fnum">F9</div>
            <h3 className="ft">Pick up where you left off</h3>
            <p className="dim">
              Open your browser tomorrow and see exactly where you were:
              what you watched, read, and asked — with a single
              &quot;continue&quot; to jump back in. No more &quot;where was
              I?&quot;
            </p>
          </div>
          <div className="fcell">
            <div className="fnum">F10</div>
            <h3 className="ft">Your learning timeline</h3>
            <p className="dim">
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