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
            <div key={quote} className="card [padding:40px_42px]">
              <p className="quote">&quot;{quote}&quot;</p>
              <div className="flex items-center [gap:12px] [margin-top:26px]">
                <div className="mono dim flex items-center justify-center [width:42px] [height:42px] [border-radius:50%] [background:#E0DCCF]">
                  ?
                </div>
                <div>
                  <div className="font-semibold [font-size:15px]">[Name]</div>
                  <div className="mono [font-size:12px] [color:#9AA69C]">[role]</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mono [font-size:12px] [color:#9AA69C] [margin-top:20px] text-center">
          Placeholder testimonials — swap in real quotes as you gather them.
        </p>
      </div>
    </div>
  );
}
