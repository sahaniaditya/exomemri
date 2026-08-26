import { Contour } from './Contour';

export function FinalCta() {
  return (
    <div className="sec" id="cta">
      <div className="wrap">
        <div className="ctaband ctaband-inner">
          <Contour invert />
          <div className="ctaband-content">
            <span className="label label-invert">Section 10 · get started</span>
            <h2 className="serif cta-title">
              Turn everything you learn <span className="it cta-title-accent">into memory.</span>
            </h2>
            <p className="cta-body">
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