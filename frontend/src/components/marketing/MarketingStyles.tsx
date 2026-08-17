'use client';

/**
 * styled-jsx only works in a Client Component, so this one file opts in —
 * every section component that imports its class names from here stays a
 * server component; only this stylesheet and Hero (its own typewriter
 * effect) ship as client JS.
 *
 * All CSS for the marketing landing page, in one place so page.tsx and its
 * section components stay pure markup. `jsx global` keeps class names
 * un-hashed so every section component below can share them, and Next only
 * keeps this stylesheet mounted while a marketing route is on screen.
 *
 * One-off static positioning/spacing on individual elements is handled with
 * Tailwind's arbitrary-value utilities directly in each component's
 * className instead of duplicating one-use rules here. The classes below are
 * either shared building blocks (`.card`, `.chip`, `.btn`, …) or "modifier"
 * classes for the handful of spots that override one of those shared
 * classes' own properties — a modifier class guarantees the override wins
 * in the cascade, which a same-specificity Tailwind utility couldn't.
 */
export function MarketingStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&family=Newsreader:ital,wght@0,400;1,400;1,500&display=swap');
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body {
        margin: 0;
        background: #F4F1E9;
        color: #1B1A16;
        font-family: 'Instrument Sans', system-ui, sans-serif;
        font-size: 17px;
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
      }
      ::selection { background: #2C5D4F; color: #F4F1E9; }
      h1, h2, h3 { margin: 0; font-weight: 400; letter-spacing: -0.01em; }
      p { margin: 0; }
      a { color: inherit; text-decoration: none; }
      .serif { font-family: 'Newsreader', Georgia, serif; font-weight: 400; line-height: 1.08; letter-spacing: -0.02em; }
      .it { font-style: italic; }
      .mono { font-family: 'IBM Plex Mono', monospace; font-weight: 400; }
      .label { font-family: 'IBM Plex Mono', monospace; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #7C8A7E; }
      .accent { color: #2C5D4F; }
      .clay { color: #B5623C; }
      .dim { color: #5B5A52; }
      .wrap { max-width: 1160px; margin: 0 auto; padding: 0 40px; }
      .sec { padding: 120px 0; position: relative; }
      .divide { border-top: 1px solid rgba(27, 26, 22, 0.12); }
      .btn {
        display: inline-flex; align-items: center; gap: 10px; white-space: nowrap;
        font-family: 'Instrument Sans'; font-weight: 600; font-size: 16px;
        padding: 15px 26px; border-radius: 2px; cursor: pointer;
        border: 1px solid transparent;
        transition: transform .18s ease, background .18s ease, box-shadow .18s ease;
        text-align: center;
      }
      .btn-p { background: #2C5D4F; color: #F4F1E9; }
      .btn-p:hover { background: #234c40; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(44,93,79,.28); }
      .btn-g { background: transparent; color: #1B1A16; border-color: rgba(27,26,22,.28); }
      .btn-g:hover { border-color: #1B1A16; background: rgba(27,26,22,.04); }
      .btn-sm { padding: 10px 18px; font-size: 14px; }
      .arrow { transition: transform .2s ease; display: inline-block; }
      .btn-p:hover .arrow, .btn-g:hover .arrow { transform: translateX(3px); }
      .nav {
        position: sticky; top: 0; z-index: 50;
        background: rgba(244,241,233,.82); backdrop-filter: blur(12px);
        border-bottom: 1px solid rgba(27,26,22,.09);
      }
      .navin { display: flex; align-items: center; justify-content: space-between; height: 68px; }
      .brand { display: flex; align-items: center; gap: 11px; font-family: 'Newsreader'; font-size: 22px; letter-spacing: -0.02em; }
      .wordmark { letter-spacing: -0.035em; font-weight: 500; }
      .navlinks { display: flex; gap: 34px; }
      .navlink { font-size: 15px; color: #3D3C36; transition: color .15s; }
      .navlink:hover { color: #2C5D4F; }
      .plate { display: flex; align-items: center; gap: 14px; margin-bottom: 34px; }
      .platenum { font-family: 'IBM Plex Mono'; font-size: 13px; color: #2C5D4F; font-weight: 500; }
      .plateline { height: 1px; flex: 1; background: rgba(27,26,22,.14); }
      .contour { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; opacity: .5; z-index: 0; }
      .hero { position: relative; overflow: hidden; padding-top: 96px; padding-bottom: 120px; }
      .h1 { font-size: 76px; letter-spacing: -0.03em; }
      .coord { position: absolute; font-family: 'IBM Plex Mono'; font-size: 11px; color: #9AA69C; letter-spacing: .1em; }
      .card { background: #FBFAF6; border: 1px solid rgba(27,26,22,.13); border-radius: 6px; box-shadow: 0 1px 0 rgba(27,26,22,.04), 0 26px 60px -30px rgba(27,26,22,.28); }
      .chip { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; padding: 6px 11px; border-radius: 100px; border: 1px solid rgba(27,26,22,.14); background: #F4F1E9; color: #3D3C36; }
      .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
      .win-bar { display: flex; align-items: center; gap: 7px; padding: 12px 16px; border-bottom: 1px solid rgba(27,26,22,.1); }
      .tl { width: 11px; height: 11px; border-radius: 50%; }
      .srcrow { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 5px; background: #F4F1E9; border: 1px solid rgba(27,26,22,.08); }
      .srcico { width: 34px; height: 34px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex: none; font-size: 15px; }
      .bubble { background: #F0EEE4; border: 1px solid rgba(27,26,22,.09); border-radius: 12px; padding: 14px 16px; font-size: 15.5px; line-height: 1.55; }
      .qbubble { background: #2C5D4F; color: #EFF3EF; border: none; align-self: flex-end; max-width: 80%; }
      .cite { display: inline-flex; align-items: center; gap: 5px; font-family: 'IBM Plex Mono'; font-size: 11.5px; color: #2C5D4F; background: rgba(44,93,79,.09); border: 1px solid rgba(44,93,79,.22); padding: 2px 8px; border-radius: 100px; }
      .caret { display: inline-block; width: 2px; height: 1.05em; background: #2C5D4F; margin-left: 1px; vertical-align: -2px; animation: blink 1s steps(1) infinite; }
      @keyframes blink { 50% { opacity: 0; } }
      .floaty { position: relative; animation: floaty 7s ease-in-out infinite; }
      @keyframes floaty { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
      .fgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; background: rgba(27,26,22,.12); border: 1px solid rgba(27,26,22,.12); border-radius: 6px; overflow: hidden; }
      .fcell { background: #F4F1E9; padding: 38px 36px; transition: background .2s; }
      .fcell:hover { background: #FBFAF6; }
      .fnum { font-family: 'IBM Plex Mono'; font-size: 12px; color: #B5623C; }
      .ft { font-family: 'Newsreader'; font-size: 25px; margin: 14px 0 10px; }
      .tab { position: absolute; background: #FBFAF6; border: 1px solid rgba(27,26,22,.13); border-radius: 5px; padding: 11px 15px; font-size: 13.5px; box-shadow: 0 12px 30px -18px rgba(27,26,22,.4); display: flex; align-items: center; gap: 9px; }
      .pull { font-family: 'Newsreader'; font-style: italic; font-size: 38px; line-height: 1.25; letter-spacing: -0.02em; }
      .step { position: relative; padding-top: 28px; }
      .stepnum { font-family: 'Newsreader'; font-size: 15px; color: #2C5D4F; border: 1px solid rgba(44,93,79,.35); width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 22px; }
      .stepbar { position: absolute; top: 19px; left: 38px; right: 0; height: 1px; background: rgba(27,26,22,.14); }
      .crow { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid rgba(27,26,22,.13); border-radius: 6px; overflow: hidden; background: #FBFAF6; }
      .ccol { padding: 34px 36px; }
      .ccol + .ccol { border-left: 1px solid rgba(27,26,22,.13); }
      .cli { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid rgba(27,26,22,.08); font-size: 15.5px; }
      .acard { background: #FBFAF6; border: 1px solid rgba(27,26,22,.12); border-radius: 6px; padding: 30px; transition: transform .2s, box-shadow .2s; }
      .acard:hover { transform: translateY(-3px); box-shadow: 0 20px 44px -28px rgba(27,26,22,.4); }
      .quote { font-family: 'Newsreader'; font-size: 30px; line-height: 1.28; letter-spacing: -0.01em; }
      .faq { border-top: 1px solid rgba(27,26,22,.14); }
      .faq summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 26px 4px; font-family: 'Newsreader'; font-size: 24px; transition: color .15s; }
      .faq summary::-webkit-details-marker { display: none; }
      .faq summary:hover { color: #2C5D4F; }
      .faq .plus { font-family: 'IBM Plex Mono'; font-size: 24px; color: #2C5D4F; transition: transform .25s; flex: none; }
      .faq details[open] .plus { transform: rotate(45deg); }
      .faq .ans { padding: 0 60px 28px 4px; color: #4A4941; font-size: 16.5px; max-width: 760px; }
      .ring-track { fill: none; stroke: rgba(27,26,22,.12); stroke-width: 9; }
      .ring-val { fill: none; stroke: #2C5D4F; stroke-width: 9; stroke-linecap: round; stroke-dasharray: 314; stroke-dashoffset: 94; transform: rotate(-90deg); transform-origin: center; }
      .ctaband { background: #1B1A16; color: #F4F1E9; border-radius: 8px; position: relative; overflow: hidden; }
      .footlink { color: #5B5A52; font-size: 14.5px; transition: color .15s; }
      .footlink:hover { color: #1B1A16; }
      .hero-grid { display: grid; grid-template-columns: 1.02fr .98fr; gap: 72px; align-items: center; }
      .problem-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center; }
      .solution-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: start; }
      .solution-sticky { position: sticky; top: 100px; }
      .steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 48px; margin-top: 56px; }
      .feature-secondary-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 32px; margin-top: 32px; }
      .feature-media-row { display: flex; }
      .feature-media-side { width: 230px; padding: 22px; border-left: 1px solid rgba(27,26,22,.1); background: #FBFAF6; }
      .audience-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
      .proof-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
      .ctaband-inner { padding: 84px 64px; text-align: center; }
      .hero-ctas { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
      .final-ctas { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
      .footer-row { padding: 44px 40px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px; }
      .footer-links { display: flex; gap: 28px; flex-wrap: wrap; }
      .problem-tabs { position: relative; height: 420px; }

      /* --- Modifier classes: override a property a shared class above also
         sets. Kept here (after the base rule) so the cascade always resolves
         in this file's own source order, instead of racing an equal-
         specificity Tailwind utility class against these bespoke rules. --- */
      .chip-sm { font-size: 11px; padding: 3px 9px; }
      .chip-hero { margin-bottom: 26px; font-size: 12px; letter-spacing: .05em; }
      .wrap-narrow { max-width: 900px; }
      .ft-sm { font-size: 22px; }
      .label-sm { font-size: 10.5px; }
      .brand-sm { font-size: 19px; }
      .srcico-sm { width: 22px; height: 22px; font-size: 11px; }
      .fcell-flush { padding: 28px 30px; border: 1px solid rgba(27,26,22,.12); border-radius: 6px; }
      .bubble-cue-green { border-left: 2px solid #2C5D4F; }
      .bubble-cue-clay { border-left: 2px solid #B5623C; }
      .cli-accent { border-top-color: rgba(44,93,79,.15); }
      .tab-accent { border-color: rgba(181,98,60,.4); background: #FBF3EE; }
      .pull-sm { font-size: 19px; }
      .stepbar-last { right: auto; width: 0; }
      .faq-last { border-bottom: 1px solid rgba(27,26,22,.14); }
      .label-invert { color: #7FA88C; }
      .hero-citations { display: flex; gap: 7px; margin-top: 12px; flex-wrap: wrap; }
      .btn-p-invert { background: #9DC3AC; color: #16241E; }
      .btn-g-invert { color: #F4F1E9; border-color: rgba(244,241,233,.32); }

      @media (max-width: 900px) {
        .h1 { font-size: 48px; }
        .navlinks { display: none; }
        .sec { padding: 76px 0; }
        .fgrid { grid-template-columns: 1fr; }
        .wrap { padding: 0 24px; }
        .hero-grid { grid-template-columns: 1fr; gap: 48px; }
        .problem-grid { grid-template-columns: 1fr; gap: 40px; }
        .solution-grid { grid-template-columns: 1fr; gap: 40px; }
        .solution-sticky { position: static; }
        .steps-grid { grid-template-columns: 1fr; gap: 40px; }
        .feature-secondary-grid { grid-template-columns: 1fr; }
        .feature-media-row { flex-direction: column; }
        .feature-media-side { width: 100%; border-left: none; border-top: 1px solid rgba(27,26,22,.1); }
        .audience-grid { grid-template-columns: repeat(2, 1fr); }
        .proof-grid { grid-template-columns: 1fr; }
        .crow { grid-template-columns: 1fr; }
        .ccol + .ccol { border-left: none; border-top: 1px solid rgba(27,26,22,.13); }
        .ctaband-inner { padding: 56px 32px; }
        .coord { display: none; }
        .problem-tabs { height: 340px; }
      }
      @media (max-width: 640px) {
        .h1 { font-size: 38px; }
        .wrap { padding: 0 18px; }
        .sec { padding: 60px 0; }
        h2.serif { font-size: 32px !important; }
        .pull { font-size: 26px; }
        .quote { font-size: 22px; }
        .audience-grid { grid-template-columns: 1fr; }
        .faq .ans { padding: 0 0 24px 0; }
        .faq summary { font-size: 19px; padding: 20px 0; }
        .navin { height: auto; padding-top: 12px; padding-bottom: 12px; flex-wrap: wrap; gap: 10px; }
        .win-bar .mono { display: none; }
        .footer-row { flex-direction: column; align-items: flex-start; gap: 16px; padding: 32px 18px; }
        .btn { font-size: 14px; padding: 12px 18px; }
        .hero-ctas .btn, .final-ctas .btn { width: 100%; justify-content: center; }
      }
    `}</style>
  );
}
