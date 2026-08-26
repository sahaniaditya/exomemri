export function WhyDifferent() {
  return (
    <div className="sec divide" id="why">
      <div className="wrap">
        <div className="plate">
          <span className="platenum">06</span>
          <span className="label">Why it&apos;s different</span>
          <span className="plateline" />
        </div>
        <h2 className="serif why-title">
          Not a note app. <span className="it accent">A memory.</span>
        </h2>
        <p className="dim why-intro">
          Other tools help you save information. exomemri helps you remember
          it — and understand it over time.
        </p>
        <div className="crow">
          <div className="ccol">
            <div className="label clay ccol-label">Most tools</div>
            <h3 className="serif ccol-title">Store &amp; search.</h3>
            <div className="cli"><span className="dim">○</span><span className="dim">Give you somewhere to put things</span></div>
            <div className="cli"><span className="dim">○</span><span className="dim">A folder of files you have to organize</span></div>
            <div className="cli"><span className="dim">○</span><span className="dim">Built around a single document</span></div>
            <div className="cli"><span className="dim">○</span><span className="dim">Remembers what you saved</span></div>
          </div>
          <div className="ccol ccol-accent">
            <div className="label accent ccol-label">exomemri</div>
            <h3 className="serif accent ccol-title">Understand &amp; remember.</h3>
            <div className="cli cli-accent"><span className="accent">●</span><span>Understands what you&apos;ve learned</span></div>
            <div className="cli cli-accent"><span className="accent">●</span><span>Connects learning across every source</span></div>
            <div className="cli cli-accent"><span className="accent">●</span><span>Tracks what you actually know</span></div>
            <div className="cli cli-accent"><span className="accent">●</span><span>Built for learning over months, not minutes</span></div>
          </div>
        </div>
        <p className="why-closing">
          The promise isn&apos;t &quot;take notes while you learn.&quot; It&apos;s:{' '}
          <span className="it accent">never lose anything you learn online again</span>{' '}
          — and instantly recall or connect it whenever you need.
        </p>
      </div>
    </div>
  );
}