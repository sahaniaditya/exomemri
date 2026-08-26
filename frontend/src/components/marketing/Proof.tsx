const TESTIMONIALS = [
  "I stopped re-watching videos I'd already seen. It just tells me what's new.",
  "It's the first tool that actually remembers what I've learned, not just what I saved.",
];

export function Proof() {
  return (
    <div className="sec divide" id="proof">
      <div className="wrap">
        <div className="plate">
          <span className="platenum">08</span>
          <span className="label">In their words</span>
          <span className="plateline" />
        </div>
        <div className="proof-grid">
          {TESTIMONIALS.map((quote) => (
            <div key={quote} className="card proof-card">
              <p className="quote">&quot;{quote}&quot;</p>
              <div className="proof-attribution">
                <div className="mono dim proof-avatar">?</div>
                <div>
                  <div className="proof-name">[Name]</div>
                  <div className="mono proof-role">[role]</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mono proof-note">
          Placeholder testimonials — swap in real quotes as you gather them.
        </p>
      </div>
    </div>
  );
}