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
            <h2 className="serif [font-size:46px]">
              One workspace for
              <br />
              everything you learn.
            </h2>
            <p className="dim [font-size:18.5px] [margin:26px_0_20px]">
              Atlas isn&apos;t another notebook. It&apos;s a learning memory
              that captures, understands, and connects everything you study
              — automatically.
            </p>
            <p className="dim [font-size:18.5px]">
              Instead of scattered saves, you get one{' '}
              <span className="accent font-semibold">Learning Space</span>{' '}
              per topic. Every source flows into it automatically. Then AI
              works across all of it at once.
            </p>
            <p className="[font-family:Newsreader] italic [font-size:23px] [margin-top:28px] [line-height:1.4]">
              It&apos;s the difference between a folder of files and a
              brain that actually remembers.
            </p>
          </div>
          <div className="card [padding:28px_30px]">
            <div className="label [margin-bottom:18px]">Ask your own knowledge</div>
            <div className="flex flex-col [gap:14px]">
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
            <div className="[margin-top:24px] [padding-top:20px] [border-top:1px_solid_rgba(27,26,22,.1)] flex [gap:10px] flex-wrap">
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
