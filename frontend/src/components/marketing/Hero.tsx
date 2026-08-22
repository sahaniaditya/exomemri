'use client';

import { Contour } from './Contour';
import { FULL_ANSWER } from './data';
import { useTypewriter } from './useTypewriter';

export function Hero() {
  const { typed, done } = useTypewriter(FULL_ANSWER);

  return (
    <div id="top" className="hero">
      <Contour />
      <span className="coord [top:120px] [right:40px]">40.7128° N · 74.0060° W</span>
      <div className="wrap relative z-[1]">
        <div className="hero-grid">
          <div>
            <div className="chip chip-hero mono">
              <span className="dot [background:#2C5D4F]" />
              Your AI learning memory
            </div>
            <h1 className="serif h1">
              Never lose anything
              <br />
              you learn online <span className="it accent">again.</span>
            </h1>
            <p className="dim [font-size:20px] [margin:28px_0_36px] [max-width:520px] [line-height:1.55]">
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
            <p className="mono [font-size:12.5px] [color:#7C8A7E] [margin-top:20px] [letter-spacing:.02em]">
              Works right inside your browser · Save with one click · No copy-paste, ever.
            </p>
          </div>
          <div className="floaty">
            <div className="card">
              <div className="win-bar">
                <span className="tl [background:#E0A03A]" />
                <span className="tl [background:#7FA88C]" />
                <span className="tl [background:#C97A5A]" />
                <span className="mono [margin-left:8px] [font-size:12px] [color:#9AA69C]">
                  Learning Space · System Design
                </span>
              </div>
              <div className="[padding:20px_20px_22px]">
                <div className="label [margin-bottom:12px]">3 sources merged</div>
                <div className="flex flex-col [gap:9px] [margin-bottom:20px]">
                  <div className="srcrow">
                    <span className="srcico srcico-sm [background:rgba(197,58,58,.1)] [color:#C53A3A]">▶</span>
                    <div className="flex-1">
                      <div className="[font-size:14.5px] font-semibold">Consistent Hashing Explained</div>
                      <div className="mono [font-size:11px] [color:#9AA69C]">YouTube · 14:22</div>
                    </div>
                    <span className="chip chip-sm">summarized</span>
                  </div>
                  <div className="srcrow">
                    <span className="srcico srcico-sm [background:rgba(44,93,79,.1)] [color:#2C5D4F]">◆</span>
                    <div className="flex-1">
                      <div className="[font-size:14.5px] font-semibold">Designing Data-Intensive Apps</div>
                      <div className="mono [font-size:11px] [color:#9AA69C]">PDF · ch. 6</div>
                    </div>
                    <span className="chip chip-sm">summarized</span>
                  </div>
                  <div className="srcrow">
                    <span className="srcico srcico-sm [background:rgba(181,98,60,.12)] [color:#B5623C]">✦</span>
                    <div className="flex-1">
                      <div className="[font-size:14.5px] font-semibold">ChatGPT · load balancers</div>
                      <div className="mono [font-size:11px] [color:#9AA69C]">AI chat · 22 msgs</div>
                    </div>
                    <span className="chip chip-sm">summarized</span>
                  </div>
                </div>
                <div className="flex flex-col [gap:12px]">
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
            <span className="coord [bottom:-26px] [left:6px]">plate 01 · recall</span>
          </div>
        </div>
      </div>
    </div>
  );
}
