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
 * Colors live in CSS variables (:root / .dark) so next-themes can flip the
 * whole page by toggling a `dark` class on <html> — nothing here should be
 * a literal hex color; if you add a new color, add a variable for it.
 */
export function MarketingStyles() {
  return (
    <style jsx global>{`
      @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&family=Newsreader:ital,wght@0,400;1,400;1,500&display=swap');

      :root {
        --paper: #F4F1E9;
        --ink: #1B1A16;
        --ink-soft: #3D3C36;
        --card: #FBFAF6;
        --bubble-bg: #F0EEE4;
        --forest: #2C5D4F;
        --forest-deep: #234c40;
        --clay: #B5623C;
        --muted: #5B5A52;
        --sage: #7C8A7E;
        --sage-light: #9AA69C;
        --on-accent: #F4F1E9;
        --tab-accent-bg: #FBF3EE;
        --cta-bg: #1B1A16;
        --cta-fg: #F4F1E9;
        --surface-tint: #F0F3F0;
        --avatar-bg: rgba(27, 26, 22, .08);
        --media-panel-bg: #EDEAE0;
        --media-caption: #4A4941;
        --video-icon: #C53A3A;
        --ink-rgb: 27, 26, 22;
        --paper-rgb: 244, 241, 233;
        --forest-rgb: 44, 93, 79;
        --clay-rgb: 181, 98, 60;
      }
      /* Dark mode: background becomes dark gray, text/borders/shadows lighten
         to match. Light mode above is untouched. next-themes toggles this
         class on <html> (attribute="class"). */
      .dark {
        --paper: #1a1a1a;
        --ink: #ececea;
        --ink-soft: #cfcfc9;
        --card: #242424;
        --bubble-bg: #262626;
        --forest: #6fae9b;
        --forest-deep: #5a9684;
        --clay: #d98b64;
        --muted: #a8a8a2;
        --sage: #8f9a8f;
        --sage-light: #6e756e;
        --on-accent: #f5f5f3;
        --tab-accent-bg: rgba(217, 139, 100, 0.12);
        --cta-bg: #0e0e0e;
        --cta-fg: #f5f5f3;
        --surface-tint: #1f2622;
        --avatar-bg: rgba(236, 236, 234, .08);
        --media-panel-bg: #262521;
        --media-caption: #cfcfc9;
        --video-icon: #e07a7a;
        --ink-rgb: 236, 236, 234;
        --paper-rgb: 26, 26, 26;
        --forest-rgb: 111, 174, 155;
        --clay-rgb: 217, 139, 100;
      }

      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body {
        margin: 0;
        background: var(--paper);
        color: var(--ink);
        font-family: 'Instrument Sans', system-ui, sans-serif;
        font-size: 17px;
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
        transition: background .2s ease, color .2s ease;
      }
      ::selection { background: var(--forest); color: var(--on-accent); }
      h1, h2, h3 { margin: 0; font-weight: 400; letter-spacing: -0.01em; }
      p { margin: 0; }
      a { color: inherit; text-decoration: none; }
      .serif { font-family: 'Newsreader', Georgia, serif; font-weight: 400; line-height: 1.08; letter-spacing: -0.02em; }
      .it { font-style: italic; }
      .mono { font-family: 'IBM Plex Mono', monospace; font-weight: 400; }
      .label { font-family: 'IBM Plex Mono', monospace; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--sage); }
      .accent { color: var(--forest); }
      .clay { color: var(--clay); }
      .dim { color: var(--muted); }
      .wrap { max-width: 1160px; margin: 0 auto; padding: 0 40px; }
      .sec { padding: 120px 0; position: relative; }
      .divide { border-top: 1px solid rgba(var(--ink-rgb), 0.12); }
      .btn {
        display: inline-flex; align-items: center; gap: 10px; white-space: nowrap;
        font-family: 'Instrument Sans'; font-weight: 600; font-size: 16px;
        padding: 15px 26px; border-radius: 2px; cursor: pointer;
        border: 1px solid transparent;
        transition: transform .18s ease, background .18s ease, box-shadow .18s ease;
        text-align: center;
      }
      .btn-p { background: var(--forest); color: var(--on-accent); }
      .btn-p:hover { background: var(--forest-deep); transform: translateY(-1px); box-shadow: 0 8px 24px rgba(var(--forest-rgb), .28); }
      .btn-g { background: transparent; color: var(--ink); border-color: rgba(var(--ink-rgb), .28); }
      .btn-g:hover { border-color: var(--ink); background: rgba(var(--ink-rgb), .04); }
      .btn-sm { padding: 10px 18px; font-size: 14px; }
      .arrow { transition: transform .2s ease; display: inline-block; }
      .btn-p:hover .arrow, .btn-g:hover .arrow { transform: translateX(3px); }
      .nav {
        position: sticky; top: 0; z-index: 50;
        background: rgba(var(--paper-rgb), .82); backdrop-filter: blur(12px);
        border-bottom: 1px solid rgba(var(--ink-rgb), .09);
      }
      .navin { display: flex; align-items: center; justify-content: space-between; height: 68px; }
      .brand { display: flex; align-items: center; gap: 11px; font-size: 20px; }
      .nav-actions { display: flex; align-items: center; gap: 10px; }
      .navlinks { display: flex; gap: 34px; }
      .navlink { font-size: 15px; color: var(--ink-soft); transition: color .15s; }
      .navlink:hover { color: var(--forest); }
      .plate { display: flex; align-items: center; gap: 14px; margin-bottom: 34px; }
      .platenum { font-family: 'IBM Plex Mono'; font-size: 13px; color: var(--forest); font-weight: 500; }
      .plateline { height: 1px; flex: 1; background: rgba(var(--ink-rgb), .14); }
      .contour { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; opacity: .5; z-index: 0; }
      .contour-path { stroke: var(--forest); opacity: 0.16; }
      .dark .contour-path { opacity: 0.22; }
      /* Fixed-dark context (sits inside .ctaband, which never flips) — intentionally not theme-reactive. */
      .contour-invert { stroke: #7FA88C; opacity: 0.22; }
      .hero { position: relative; overflow: hidden; padding-top: 96px; padding-bottom: 120px; }
      .hero-content { position: relative; z-index: 1; }
      .coord-top-right { top: 120px; right: 40px; }
      .coord-bottom-left { bottom: -26px; left: 6px; }
      .dot-forest { background: var(--forest); }
      .hero-intro { font-size: 20px; margin: 28px 0 36px; max-width: 520px; line-height: 1.55; }
      .hero-note { font-family: 'IBM Plex Mono'; font-size: 12.5px; color: var(--sage); margin-top: 20px; letter-spacing: .02em; }
      .hero-card-body { padding: 20px 20px 22px; }
      .hero-card-label { margin-bottom: 12px; }
      .src-list { display: flex; flex-direction: column; gap: 9px; margin-bottom: 20px; }
      .srcrow-title { font-size: 14.5px; font-weight: 600; }
      .srcrow-meta { font-size: 11px; color: var(--sage-light); }
      .chat-stack { display: flex; flex-direction: column; gap: 12px; }
      .srcico-video { background: rgba(197, 58, 58, .1); color: var(--video-icon); }
      .srcico-doc { background: rgba(var(--forest-rgb), .1); color: var(--forest); }
      .srcico-ai { background: rgba(var(--clay-rgb), .12); color: var(--clay); }
      .h1 { font-size: 76px; letter-spacing: -0.03em; }
      .coord { position: absolute; font-family: 'IBM Plex Mono'; font-size: 11px; color: var(--sage-light); letter-spacing: .1em; }
      .card { background: var(--card); border: 1px solid rgba(var(--ink-rgb), .13); border-radius: 6px; box-shadow: 0 1px 0 rgba(var(--ink-rgb), .04), 0 26px 60px -30px rgba(var(--ink-rgb), .28); }
      .card-flush { padding: 0; overflow: hidden; }
      .chip { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; padding: 6px 11px; border-radius: 100px; border: 1px solid rgba(var(--ink-rgb), .14); background: var(--paper); color: var(--ink-soft); }
      .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
      .win-bar { display: flex; align-items: center; gap: 7px; padding: 12px 16px; border-bottom: 1px solid rgba(var(--ink-rgb), .1); }
      .win-bar .mono { margin-left: 8px; font-size: 12px; color: var(--sage-light); }
      .tl { width: 11px; height: 11px; border-radius: 50%; }
      .tl-amber { background: #E0A03A; }
      .tl-sage { background: #7FA88C; }
      .tl-clay { background: #C97A5A; }
      .srcrow { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 5px; background: var(--paper); border: 1px solid rgba(var(--ink-rgb), .08); }
      .srcico { width: 34px; height: 34px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex: none; font-size: 15px; }
      .bubble { background: var(--bubble-bg); border: 1px solid rgba(var(--ink-rgb), .09); border-radius: 12px; padding: 14px 16px; font-size: 15.5px; line-height: 1.55; }
      .qbubble { background: var(--forest); color: var(--on-accent); border: none; align-self: flex-end; max-width: 80%; }
      .cite { display: inline-flex; align-items: center; gap: 5px; font-family: 'IBM Plex Mono'; font-size: 11.5px; color: var(--forest); background: rgba(var(--forest-rgb), .09); border: 1px solid rgba(var(--forest-rgb), .22); padding: 2px 8px; border-radius: 100px; }
      .caret { display: inline-block; width: 2px; height: 1.05em; background: var(--forest); margin-left: 1px; vertical-align: -2px; animation: blink 1s steps(1) infinite; }
      @keyframes blink { 50% { opacity: 0; } }
      .floaty { position: relative; animation: floaty 7s ease-in-out infinite; }
      @keyframes floaty { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
      .fgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px; background: rgba(var(--ink-rgb), .12); border: 1px solid rgba(var(--ink-rgb), .12); border-radius: 6px; overflow: hidden; }
      .fgrid-mt { margin-top: 32px; }
      .fcell { background: var(--paper); padding: 38px 36px; transition: background .2s; }
      .fcell:hover { background: var(--card); }
      .fcell p { font-size: 16px; }
      .fnum { font-family: 'IBM Plex Mono'; font-size: 12px; color: var(--clay); }
      .ft { font-family: 'Newsreader'; font-size: 25px; margin: 14px 0 10px; }
      .tab { position: absolute; background: var(--card); border: 1px solid rgba(var(--ink-rgb), .13); border-radius: 5px; padding: 11px 15px; font-size: 13.5px; box-shadow: 0 12px 30px -18px rgba(var(--ink-rgb), .4); display: flex; align-items: center; gap: 9px; }
      .pull { font-family: 'Newsreader'; font-style: italic; font-size: 38px; line-height: 1.25; letter-spacing: -0.02em; }
      .step { position: relative; padding-top: 28px; }
      .step p { font-size: 16.5px; }
      .stepnum { font-family: 'Newsreader'; font-size: 15px; color: var(--forest); border: 1px solid rgba(var(--forest-rgb), .35); width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 22px; }
      .stepbar { position: absolute; top: 19px; left: 38px; right: 0; height: 1px; background: rgba(var(--ink-rgb), .14); }
      .crow { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border: 1px solid rgba(var(--ink-rgb), .13); border-radius: 6px; overflow: hidden; background: var(--card); }
      .ccol { padding: 34px 36px; }
      .ccol + .ccol { border-left: 1px solid rgba(var(--ink-rgb), .13); }
      .ccol-label { margin-bottom: 8px; }
      .ccol-title { font-size: 26px; margin-bottom: 8px; }
      .ccol-accent { background: var(--surface-tint); }
      .cli { display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid rgba(var(--ink-rgb), .08); font-size: 15.5px; }
      .acard { background: var(--card); border: 1px solid rgba(var(--ink-rgb), .12); border-radius: 6px; padding: 30px; transition: transform .2s, box-shadow .2s; }
      .acard:hover { transform: translateY(-3px); box-shadow: 0 20px 44px -28px rgba(var(--ink-rgb), .4); }
      .ficon { font-size: 26px; }
      .acard h3 { font-size: 22px; margin-bottom: 10px; }
      .acard p { font-size: 15px; }
      .quote { font-family: 'Newsreader'; font-size: 30px; line-height: 1.28; letter-spacing: -0.01em; }
      .faq { border-top: 1px solid rgba(var(--ink-rgb), .14); }
      .faq summary { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 26px 4px; font-family: 'Newsreader'; font-size: 24px; transition: color .15s; }
      .faq summary::-webkit-details-marker { display: none; }
      .faq summary:hover { color: var(--forest); }
      .faq .plus { font-family: 'IBM Plex Mono'; font-size: 24px; color: var(--forest); transition: transform .25s; flex: none; }
      .faq details[open] .plus { transform: rotate(45deg); }
      .faq .ans { padding: 0 60px 28px 4px; color: var(--muted); font-size: 16.5px; max-width: 760px; }
      .ring-track { fill: none; stroke: rgba(var(--ink-rgb), .12); stroke-width: 9; }
      .ring-val { fill: none; stroke: var(--forest); stroke-width: 9; stroke-linecap: round; stroke-dasharray: 314; stroke-dashoffset: 94; transform: rotate(-90deg); transform-origin: center; }
      .ctaband { background: var(--cta-bg); color: var(--cta-fg); border-radius: 8px; position: relative; overflow: hidden; }
      .ctaband-content { position: relative; z-index: 1; }
      .cta-title { font-size: 56px; margin: 20px auto 18px; max-width: 720px; }
      .cta-title-accent { color: #9DC3AC; }
      .cta-body { color: #C9C6BC; font-size: 19px; max-width: 520px; margin: 0 auto 36px; }
      .footlink { color: var(--muted); font-size: 14.5px; transition: color .15s; }
      .footlink:hover { color: var(--ink); }
      .footer-copy { font-size: 12px; color: var(--sage-light); }
      .hero-grid { display: grid; grid-template-columns: 1.02fr .98fr; gap: 72px; align-items: center; }
      .problem-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: center; }
      .solution-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 72px; align-items: start; }
      .solution-sticky { position: sticky; top: 100px; }
      .solution-title { font-size: 46px; }
      .solution-copy { font-size: 18.5px; margin: 26px 0 20px; }
      .solution-copy-last { font-size: 18.5px; }
      .solution-pull { font-family: 'Newsreader'; font-style: italic; font-size: 23px; margin-top: 28px; line-height: 1.4; }
      .solution-card { padding: 28px 30px; }
      .solution-card .label { margin-bottom: 18px; }
      .solution-bubbles { display: flex; flex-direction: column; gap: 14px; }
      .solution-chips { margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(var(--ink-rgb), .1); display: flex; gap: 10px; flex-wrap: wrap; }
      .steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 48px; margin-top: 56px; }
      .how-title { font-size: 46px; margin-bottom: 14px; }
      .step-title { font-size: 28px; margin-bottom: 12px; }
      .feature-secondary-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 32px; margin-top: 32px; }
      .feature-media-row { display: flex; }
      .feature-media-side { width: 230px; padding: 22px; border-left: 1px solid rgba(var(--ink-rgb), .1); background: var(--card); }
      .feature-media-side .label { margin-bottom: 16px; }
      .feature-media-main { flex: 1; padding: 26px; background: var(--media-panel-bg); }
      .feature-secondary-col { display: flex; flex-direction: column; gap: 20px; }
      .skeleton-line { height: 12px; width: 70%; background: rgba(var(--ink-rgb), .12); border-radius: 3px; margin-bottom: 12px; }
      .video-placeholder { height: 170px; background: rgba(var(--ink-rgb), .16); border-radius: 5px; display: flex; align-items: center; justify-content: center; color: var(--sage-light); }
      .ring-wrap { display: flex; justify-content: center; margin-bottom: 14px; }
      .media-caption { font-size: 13.5px; color: var(--media-caption); text-align: center; }
      .features-head { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 20px; margin-bottom: 44px; }
      .features-title { font-size: 46px; }
      .features-intro { max-width: 380px; font-size: 16.5px; }
      .audience-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
      .audience-title { font-size: 46px; margin-bottom: 44px; }
      .why-title { font-size: 52px; text-align: center; max-width: 760px; margin: 0 auto 12px; }
      .why-intro { text-align: center; max-width: 560px; margin: 0 auto 52px; font-size: 18px; }
      .why-closing { text-align: center; font-family: 'Newsreader'; font-size: 26px; line-height: 1.4; max-width: 720px; margin: 52px auto 0; }
      .proof-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
      .proof-card { padding: 40px 42px; }
      .proof-attribution { display: flex; align-items: center; gap: 12px; margin-top: 26px; }
      .proof-avatar { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--avatar-bg); }
      .proof-name { font-size: 15px; font-weight: 600; }
      .proof-role { font-size: 12px; color: var(--sage-light); }
      .proof-note { font-size: 12px; color: var(--sage-light); margin-top: 20px; text-align: center; }
      .faq-title { font-size: 46px; margin-bottom: 40px; }
      .problem-title { font-size: 46px; }
      .problem-copy { font-size: 18.5px; margin: 26px 0 22px; }
      .problem-lead { font-size: 18.5px; margin-top: 22px; }
      .problem-quote-block { margin-top: 64px; text-align: center; border-top: 1px solid rgba(var(--ink-rgb), .1); padding-top: 52px; }
      .problem-quote { max-width: 820px; margin: 0 auto; }
      .tab-1 { top: 14px; left: 10px; transform: rotate(-4deg); }
      .tab-2 { top: 78px; right: 0; transform: rotate(3deg); }
      .tab-3 { top: 150px; left: 40px; transform: rotate(-2deg); }
      .tab-4 { bottom: 96px; right: 24px; transform: rotate(5deg); }
      .tab-5 { bottom: 20px; left: 18px; transform: rotate(-3deg); }
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
      .fcell-flush { padding: 28px 30px; border: 1px solid rgba(var(--ink-rgb), .12); border-radius: 6px; }
      .fcell-flush p { font-size: 15.5px; }
      .bubble-cue-green { border-left: 2px solid var(--forest); }
      .bubble-cue-clay { border-left: 2px solid var(--clay); }
      .cli-accent { border-top-color: rgba(var(--forest-rgb), .15); }
      .tab-accent { border-color: rgba(var(--clay-rgb), .4); background: var(--tab-accent-bg); }
      .pull-sm { font-size: 19px; }
      .stepbar-last { right: auto; width: 0; }
      .faq-last { border-bottom: 1px solid rgba(var(--ink-rgb), .14); }
      /* Fixed-dark context (sits inside .ctaband, which never flips) — intentionally not theme-reactive. */
      .label-invert { color: #7FA88C; }
      .hero-citations { display: flex; gap: 7px; margin-top: 12px; flex-wrap: wrap; }
      .btn-p-invert { background: #9DC3AC; color: #16241E; }
      .btn-g-invert { color: #F4F1E9; border-color: rgba(244, 241, 233, .32); }
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
        .feature-media-side { width: 100%; border-left: none; border-top: 1px solid rgba(var(--ink-rgb), .1); }
        .audience-grid { grid-template-columns: repeat(2, 1fr); }
        .proof-grid { grid-template-columns: 1fr; }
        .crow { grid-template-columns: 1fr; }
        .ccol + .ccol { border-left: none; border-top: 1px solid rgba(var(--ink-rgb), .13); }
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