export function Problem() {
  return (
    <div className="sec divide" id="problem">
      <div className="wrap">
        <div className="plate">
          <span className="platenum">02</span>
          <span className="label">The problem</span>
          <span className="plateline" />
        </div>
        <div className="problem-grid">
          <div>
            <h2 className="serif problem-title">
              The pain every
              <br />
              self-learner knows.
            </h2>
            <p className="dim problem-copy">
              You learn from everywhere now — YouTube, blogs, docs, ChatGPT,
              PDFs. But your learning is scattered across a dozen tabs and
              tools, and three days later it&apos;s gone.
            </p>
            <p className="dim problem-copy" style={{ margin: 0 }}>
              You watch five videos, read three articles, have ten AI
              conversations, skim the docs. Then a week later, it&apos;s
              all just… somewhere.
            </p>
            <p className="problem-lead">
              It was never about taking notes. It&apos;s about learning
              across fragmented sources and actually remembering it. Note
              apps give you another empty page.{' '}
              <span className="accent font-semibold">What you need is memory.</span>
            </p>
          </div>
          <div className="problem-tabs">
            <div className="tab tab-1">
              <span className="srcico srcico-sm srcico-video">▶</span>
              17 open tabs
            </div>
            <div className="tab tab-2">
              <span className="srcico srcico-sm srcico-doc">◆</span>
              bookmarks_untitled
            </div>
            <div className="tab tab-3">
              <span className="srcico srcico-sm srcico-ai">✦</span>
              ChatGPT history
            </div>
            <div className="tab tab-4">
              📄 notes-final-v3.md
            </div>
            <div className="tab tab-accent tab-5">
              <span className="pull pull-sm clay">&quot;…where was it?&quot;</span>
            </div>
          </div>
        </div>
        <div className="problem-quote-block">
          <p className="pull problem-quote">
            <span className="clay">&quot;</span>There was an amazing explanation of consistent hashing…{' '}
            <span className="dim">where was it?</span>
            <span className="clay">&quot;</span>
          </p>
        </div>
      </div>
    </div>
  );
}