export function Solution() {
  return (
    <div className="sec divide" id="solution">
      <div className="wrap">
        <div className="plate">
          <span className="platenum">03</span>
          <span className="label">The solution</span>
          <span className="plateline" />
        </div>
        <div className="solution-grid">
          <div className="solution-sticky">
            <h2 className="serif solution-title">
              One workspace for
              <br />
              everything you learn.
            </h2>
            <p className="dim solution-copy">
              exomemri isn&apos;t another notebook. It&apos;s a learning memory
              that captures, understands, and connects everything you study
              — automatically.
            </p>
            <p className="dim solution-copy-last">
              Instead of scattered saves, you get one{' '}
              <span className="accent font-semibold">Learning Space</span>{' '}
              per topic. Every source flows into it automatically. Then AI
              works across all of it at once.
            </p>
            <p className="solution-pull">
              It&apos;s the difference between a folder of files and a
              brain that actually remembers.
            </p>
          </div>
          <div className="card solution-card">
            <div className="label">Ask your own knowledge</div>
            <div className="solution-bubbles">
              <div className="bubble bubble-cue-green">
                &quot;Explain caching based on everything I&apos;ve studied.&quot;
              </div>
              <div className="bubble bubble-cue-clay">
                &quot;What concepts have I not covered yet?&quot;
              </div>
              <div className="bubble bubble-cue-green">
                &quot;Summarize only what I highlighted.&quot;
              </div>
            </div>
            <div className="solution-chips">
              <span className="chip">🎬 videos</span>
              <span className="chip">📰 articles</span>
              <span className="chip">✦ AI chats</span>
              <span className="chip">◆ PDFs</span>
              <span className="chip">✎ your notes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}