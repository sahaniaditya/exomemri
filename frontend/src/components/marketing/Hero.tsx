'use client';
import { Contour } from './Contour';
import { FULL_ANSWER } from './data';
import { useTypewriter } from './useTypewriter';

export function Hero() {
  const { typed, done } = useTypewriter(FULL_ANSWER);
  return (
    <div id="top" className="hero">
      <Contour />
      <span className="coord coord-top-right">40.7128° N · 74.0060° W</span>
      <div className="wrap hero-content">
        <div className="hero-grid">
          <div>
            <div className="chip chip-hero mono">
              <span className="dot dot-forest" />
              Your AI learning memory
            </div>
            <h1 className="serif h1">
              Never lose anything
              <br />
              you learn online <span className="it accent">again.</span>
            </h1>
            <p className="dim hero-intro">
              exomemri captures every video, article, and AI chat you learn from,
              understands it, and remembers it for you — so you can recall or
              connect anything, instantly.
            </p>
            <div className="hero-ctas">
              <a href="/signup" className="btn btn-p">
                Start building your learning memory — free <span className="arrow">→</span>
              </a>
              <a href="/login" className="btn btn-g">
                Log in
              </a>
            </div>
            <p className="mono hero-note">
              Works right inside your browser · Save with one click · No copy-paste, ever.
            </p>
          </div>
          <div className="floaty">
            <div className="card">
              <div className="win-bar">
                <span className="tl tl-amber" />
                <span className="tl tl-sage" />
                <span className="tl tl-clay" />
                <span className="mono">Learning Space · System Design</span>
              </div>
              <div className="hero-card-body">
                <div className="label hero-card-label">3 sources merged</div>
                <div className="src-list">
                  <div className="srcrow">
                    <span className="srcico srcico-sm srcico-video">▶</span>
                    <div className="flex-1">
                      <div className="srcrow-title">Consistent Hashing Explained</div>
                      <div className="mono srcrow-meta">YouTube · 14:22</div>
                    </div>
                    <span className="chip chip-sm">summarized</span>
                  </div>
                  <div className="srcrow">
                    <span className="srcico srcico-sm srcico-doc">◆</span>
                    <div className="flex-1">
                      <div className="srcrow-title">Designing Data-Intensive Apps</div>
                      <div className="mono srcrow-meta">PDF · ch. 6</div>
                    </div>
                    <span className="chip chip-sm">summarized</span>
                  </div>
                  <div className="srcrow">
                    <span className="srcico srcico-sm srcico-ai">✦</span>
                    <div className="flex-1">
                      <div className="srcrow-title">ChatGPT · load balancers</div>
                      <div className="mono srcrow-meta">AI chat · 22 msgs</div>
                    </div>
                    <span className="chip chip-sm">summarized</span>
                  </div>
                </div>
                <div className="chat-stack">
                  <div className="bubble qbubble">Explain caching based on everything I&apos;ve studied.</div>
                  <div className="bubble">
                    <span>{typed}</span>
                    <span className="caret" style={{ display: done ? 'none' : 'inline-block' }} />
                    <div className="hero-citations" style={{ display: done ? 'flex' : 'none' }}>
                      <span className="cite">▶ 14:22 in video</span>
                      <span className="cite">◆ DDIA p.184</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <span className="coord coord-bottom-left">plate 01 · recall</span>
          </div>
        </div>
      </div>
    </div>
  );
}