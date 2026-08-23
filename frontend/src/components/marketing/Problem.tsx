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
            <h2 className="serif [font-size:46px]">
              The pain every
              <br />
              self-learner knows.
            </h2>
            <p className="dim [font-size:18.5px] [margin:26px_0_22px]">
              You learn from everywhere now — YouTube, blogs, docs, ChatGPT,
              PDFs. But your learning is scattered across a dozen tabs and
              tools, and three days later it&apos;s gone.
            </p>
            <p className="dim [font-size:18.5px]">
              You watch five videos, read three articles, have ten AI
              conversations, skim the docs. Then a week later, it&apos;s
              all just… somewhere.
            </p>
            <p className="[font-size:18.5px] [margin-top:22px]">
              It was never about taking notes. It&apos;s about learning
              across fragmented sources and actually remembering it. Note
              apps give you another empty page.{' '}
              <span className="accent font-semibold">What you need is memory.</span>
            </p>
          </div>
          <div className="problem-tabs">
            <div className="tab [top:14px] [left:10px] [transform:rotate(-4deg)]">
              <span className="srcico srcico-sm [background:rgba(197,58,58,.1)] [color:#C53A3A]">▶</span>
              17 open tabs
            </div>
            <div className="tab [top:78px] [right:0px] [transform:rotate(3deg)]">
              <span className="srcico srcico-sm [background:rgba(44,93,79,.1)] [color:#2C5D4F]">◆</span>
              bookmarks_untitled
            </div>
            <div className="tab [top:150px] [left:40px] [transform:rotate(-2deg)]">
              <span className="srcico srcico-sm [background:rgba(181,98,60,.12)] [color:#B5623C]">✦</span>
              ChatGPT history
            </div>
            <div className="tab [bottom:96px] [right:24px] [transform:rotate(5deg)]">
              📄 notes-final-v3.md
            </div>
            <div className="tab tab-accent [bottom:20px] [left:18px] [transform:rotate(-3deg)]">
              <span className="pull pull-sm clay">&quot;…where was it?&quot;</span>
            </div>
          </div>
        </div>
        <div className="[margin-top:64px] text-center [border-top:1px_solid_rgba(27,26,22,.1)] [padding-top:52px]">
          <p className="pull [max-width:820px] [margin:0_auto]">
            <span className="clay">&quot;</span>There was an amazing explanation of consistent hashing…{' '}
            <span className="dim">where was it?</span>
            <span className="clay">&quot;</span>
          </p>
        </div>
      </div>
    </div>
  );
}
