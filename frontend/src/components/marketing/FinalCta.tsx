import { Contour } from './Contour';

export function FinalCta() {
  return (
    <div className="sec" id="cta">
      <div className="wrap">
        <div className="ctaband ctaband-inner">
          <Contour dark style={{ opacity: 0.22 }} />
          <div className="relative z-[1]">
            <span className="label label-invert">Section 10 · get started</span>
            <h2 className="serif [font-size:56px] [margin:20px_0_18px] [max-width:720px] [margin-left:auto] [margin-right:auto]">
              Turn everything you learn <span className="it [color:#9DC3AC]">into memory.</span>
            </h2>
            <p className="[color:#C9C6BC] [font-size:19px] [max-width:520px] [margin:0_auto_36px]">
              Stop losing what you study. Start building a learning memory
              that grows with you — your first Learning Space in minutes.
            </p>
            <div className="final-ctas">
              <a href="/signup" className="btn btn-p btn-p-invert">
                Get started free <span className="arrow">→</span>
              </a>
              <a href="/login" className="btn btn-g btn-g-invert">
                Log in
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
