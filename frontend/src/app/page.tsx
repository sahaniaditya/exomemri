
'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
/* ---------------------------------------------------------------
   Atlas — "Never lose anything you learn online again."
   Rebuilt from the decoded bundler template. Structure, copy, and
   styling follow the original source as closely as possible.
   "Start free" -> /signup, "Log in" -> /login
----------------------------------------------------------------- */
function Glyph({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className="glyph">
      <circle cx="16" cy="16" r="14.5" stroke="#2C5D4F" />
      <path
        d="M16 1.5v29M1.5 16h29M6 6c6 5 14 5 20 0M6 26c6-5 14-5 20 0M4.2 10.5c7 3.5 16.6 3.5 23.6 0M4.2 21.5c7-3.5 16.6-3.5 23.6 0"
        stroke="#2C5D4F"
        strokeWidth="1"
        opacity=".55"
      />
      <circle cx="16" cy="16" r="2.4" fill="#B5623C" />
    </svg>
  );
}
function Contour({ style, dark = false }: { style?: React.CSSProperties; dark?: boolean }) {
  const stroke = dark ? '#7FA88C' : '#2C5D4F';
  const opacity = dark ? 0.22 : 0.16;
  return (
    <svg
      className="contour"
      viewBox="0 0 1440 700"
      preserveAspectRatio="xMidYMid slice"
      style={style}
      aria-hidden="true"
    >
      <g fill="none" stroke={stroke} strokeWidth="1" opacity={opacity}>
        <path d="M-50 420C220 300 360 480 640 380 940 272 1120 470 1520 360" />
        <path d="M-50 470C220 350 360 530 640 430 940 322 1120 520 1520 410" />
        <path d="M-50 520C220 400 360 580 640 480 940 372 1120 570 1520 460" />
        <path d="M-50 370C240 260 380 430 660 330 960 222 1120 420 1520 310" />
        <path d="M-50 320C260 220 400 380 680 290 980 190 1120 370 1520 270" />
        <path d="M-50 570C200 460 360 630 640 530 940 422 1120 620 1520 510" />
      </g>
    </svg>
  );
}
const FULL_ANSWER =
  "Across your sources, caching stores frequently-accessed data closer to where it's used to cut latency. You've covered cache-aside and write-through — but you haven't studied cache invalidation yet.";
function useTypewriter(text: string, delay = 900, speed = 26, step = 2) {
  const [typed, setTyped] = useState('');
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    let i = 0;
    const tick = () => {
      if (i <= text.length) {
        setTyped(text.slice(0, i));
        i += step;
        timer.current = setTimeout(tick, speed);
      } else {
        setTyped(text);
        setDone(true);
      }
    };
    timer.current = setTimeout(tick, delay);
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [text, delay, speed, step]);
  return { typed, done };
}
const NAV_LINKS = [
  { label: 'How it works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Why Atlas', href: '#why' },
  { label: 'FAQ', href: '#faq' },
];
const FEATURES_MAIN = [
  {
    n: 'F1',
    title: 'One-click capture',
    body: 'Save any page, YouTube video, or AI conversation into a topic with a single click. Highlight a passage to keep just what matters — without ever breaking your flow.',
  },
  {
    n: 'F2',
    title: 'Learning Spaces',
    body: 'Start with a goal, not a blank page. Create a space like "System Design," and everything you consume flows into it automatically — organized without manual filing.',
  },
  {
    n: 'F3',
    title: 'Instant AI summaries',
    body: 'Every source becomes a crisp summary the moment you save it: key points, core concepts, examples, and interview-ready takeaways. Useful immediately, not a growing to-read pile.',
  },
  {
    n: 'F4',
    title: 'Knowledge that merges itself',
    body: "When three videos and an article all explain load balancers, Atlas combines them into one clear, connected note — with references back to every source. Real understanding, not duplicate clutter.",
  },
  {
    n: 'F5',
    title: 'Ask your memory',
    body: "Chat with everything you've ever saved. Get answers drawn from your own sources, with citations that jump you straight back to where a concept was taught — down to the exact moment in a video.",
  },
  {
    n: 'F6',
    title: 'Know what you know',
    body: "Atlas tracks what you've actually learned versus what you've merely saved. See your coverage on a topic, spot weak areas, and get told exactly what to study next — like a tutor, not a filing cabinet.",
  },
];
const STEPS = [
  {
    n: 1,
    title: 'Capture',
    body: 'See something worth learning? Click once. Videos, articles, AI chats, and PDFs are saved into the right topic — no copy-paste, no lost tabs.',
  },
  {
    n: 2,
    title: 'Understand',
    body: 'Atlas instantly summarizes each source, pulls out the key concepts, and merges what you learn across sources into one clean, connected picture.',
  },
  {
    n: 3,
    title: 'Recall',
    body: 'Ask your memory anything, review with quizzes and flashcards built from your own material, and pick up exactly where you left off — any time.',
  },
];
const AUDIENCE = [
  { icon: '⌘', title: 'Developers', body: "Preparing for technical interviews who can't afford to forget what they studied." },
  { icon: '✎', title: 'Students', body: 'Juggling courses, videos, and articles across dozens of topics.' },
  { icon: '✦', title: 'Self-learners', body: 'Who use AI chats as a temporary brain and want a permanent one.' },
  { icon: '↗', title: 'Career switchers', body: 'Teaching themselves new fields from scattered online sources.' },
];
const FAQS = [
  {
    q: "Isn't this just another note-taking app?",
    a: 'No. Note apps give you a blank page. Atlas captures your sources automatically, understands them, and tracks what you actually know — so it works like memory, not a notebook.',
    open: true,
  },
  {
    q: 'How is it different from NotebookLM or Recall?',
    a: 'Those tools store and let you chat with your sources. Atlas adds a model of your understanding: coverage, gaps, and "you already know 70% of this" context while you browse — built around learning over months, not single documents.',
  },
  {
    q: 'Do I have to copy-paste anything?',
    a: "Never. Capture is one click, right where you're already learning — in your browser.",
  },
  {
    q: 'What can I save?',
    a: 'YouTube videos, web articles, AI conversations, PDFs, and your own notes and highlights — all into one topic.',
  },
];
export default function Home() {
  const { typed, done } = useTypewriter(FULL_ANSWER);
  return (
    <>
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
        .floaty { animation: floaty 7s ease-in-out infinite; }
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
        @media (max-width: 900px) {
          .h1 { font-size: 48px; }
          .navlinks { display: none; }
          .sec { padding: 76px 0; }
          .fgrid { grid-template-columns: 1fr; }
          .wrap { padding: 0 24px; }
        }
      `}</style>

      {/* ---------------- Nav ---------------- */}
      <div className="nav">
        <div className="wrap navin">
          <a href="/" className="brand">
            <Glyph />
            <span className="wordmark">
              atlas<span className="accent">.ai</span>
            </span>
          </a>
          <nav className="navlinks">
            {NAV_LINKS.map((l) => (
              <a key={l.label} className="navlink" href={l.href}>
                {l.label}
              </a>
            ))}
          </nav>
          {/* Nav CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <a href="/login" className="btn btn-g btn-sm">
              Log in
            </a>
            <a href="/signup" className="btn btn-p btn-sm">
              Start free
            </a>
          </div>
        </div>
      </div>

      {/* ---------------- Hero ---------------- */}
      <div id="top" className="hero">
        <Contour />
        <span className="coord" style={{ top: 120, right: 40 }}>
          40.7128° N · 74.0060° W
        </span>
        <div className="wrap" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.02fr .98fr', gap: 72, alignItems: 'center' }}>
            <div>
              <div className="chip mono" style={{ marginBottom: 26, fontSize: 12, letterSpacing: '.05em' }}>
                <span className="dot" style={{ background: '#2C5D4F' }} />
                Your AI learning memory
              </div>
              <h1 className="serif h1">
                Never lose anything
                <br />
                you learn online <span className="it accent">again.</span>
              </h1>
              <p className="dim" style={{ fontSize: 20, margin: '28px 0 36px', maxWidth: 520, lineHeight: 1.55 }}>
                Atlas captures every video, article, and AI chat you learn from,
                understands it, and remembers it for you — so you can recall or
                connect anything, instantly.
              </p>
              {/* Hero CTAs */}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                <a href="/signup" className="btn btn-p">
                  Start building your learning memory — free <span className="arrow">→</span>
                </a>
                <a href="/login" className="btn btn-g">
                  Log in
                </a>
              </div>
              <p className="mono" style={{ fontSize: 12.5, color: '#7C8A7E', marginTop: 20, letterSpacing: '.02em' }}>
                Works right inside your browser · Save with one click · No copy-paste, ever.
              </p>
            </div>
            <div className="floaty" style={{ position: 'relative' }}>
              <div className="card">
                <div className="win-bar">
                  <span className="tl" style={{ background: '#E0A03A' }} />
                  <span className="tl" style={{ background: '#7FA88C' }} />
                  <span className="tl" style={{ background: '#C97A5A' }} />
                  <span className="mono" style={{ marginLeft: 8, fontSize: 12, color: '#9AA69C' }}>
                    Learning Space · System Design
                  </span>
                </div>
                <div style={{ padding: '20px 20px 22px' }}>
                  <div className="label" style={{ marginBottom: 12 }}>3 sources merged</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
                    <div className="srcrow">
                      <span className="srcico" style={{ background: 'rgba(197,58,58,.1)', color: '#C53A3A' }}>▶</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 500 }}>Consistent Hashing Explained</div>
                        <div className="mono" style={{ fontSize: 11, color: '#9AA69C' }}>YouTube · 14:22</div>
                      </div>
                      <span className="chip" style={{ fontSize: 11, padding: '3px 9px' }}>summarized</span>
                    </div>
                    <div className="srcrow">
                      <span className="srcico" style={{ background: 'rgba(44,93,79,.1)', color: '#2C5D4F' }}>◆</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 500 }}>Designing Data-Intensive Apps</div>
                        <div className="mono" style={{ fontSize: 11, color: '#9AA69C' }}>PDF · ch. 6</div>
                      </div>
                      <span className="chip" style={{ fontSize: 11, padding: '3px 9px' }}>summarized</span>
                    </div>
                    <div className="srcrow">
                      <span className="srcico" style={{ background: 'rgba(181,98,60,.12)', color: '#B5623C' }}>✦</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 500 }}>ChatGPT · load balancers</div>
                        <div className="mono" style={{ fontSize: 11, color: '#9AA69C' }}>AI chat · 22 msgs</div>
                      </div>
                      <span className="chip" style={{ fontSize: 11, padding: '3px 9px' }}>summarized</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="bubble qbubble">Explain caching based on everything I&apos;ve studied.</div>
                    <div className="bubble">
                      <span>{typed}</span>
                      <span className="caret" style={{ display: done ? 'none' : 'inline-block' }} />
                      <div style={{ display: done ? 'flex' : 'none', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
                        <span className="cite">▶ 14:22 in video</span>
                        <span className="cite">◆ DDIA p.184</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <span className="coord" style={{ bottom: -26, left: 6 }}>plate 01 · recall</span>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- 02 The problem ---------------- */}
      <div className="sec divide" id="problem">
        <div className="wrap">
          <div className="plate">
            <span className="platenum">02</span>
            <span className="label" style={{ color: '#7C8A7E' }}>The problem</span>
            <span className="plateline" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>
            <div>
              <h2 className="serif" style={{ fontSize: 46 }}>
                The pain every
                <br />
                self-learner knows.
              </h2>
              <p className="dim" style={{ fontSize: 18.5, margin: '26px 0 22px' }}>
                You learn from everywhere now — YouTube, blogs, docs, ChatGPT,
                PDFs. But your learning is scattered across a dozen tabs and
                tools, and three days later it&apos;s gone.
              </p>
              <p className="dim" style={{ fontSize: 18.5 }}>
                You watch five videos, read three articles, have ten AI
                conversations, skim the docs. Then a week later, it&apos;s
                all just… somewhere.
              </p>
              <p style={{ fontSize: 18.5, marginTop: 22 }}>
                It was never about taking notes. It&apos;s about learning
                across fragmented sources and actually remembering it. Note
                apps give you another empty page.{' '}
                <span className="accent" style={{ fontWeight: 600 }}>
                  What you need is memory.
                </span>
              </p>
            </div>
            <div style={{ position: 'relative', height: 420 }}>
              <div className="tab" style={{ top: 14, left: 10, transform: 'rotate(-4deg)' }}>
                <span className="srcico" style={{ width: 22, height: 22, fontSize: 11, background: 'rgba(197,58,58,.1)', color: '#C53A3A' }}>▶</span>
                17 open tabs
              </div>
              <div className="tab" style={{ top: 78, right: 0, transform: 'rotate(3deg)' }}>
                <span className="srcico" style={{ width: 22, height: 22, fontSize: 11, background: 'rgba(44,93,79,.1)', color: '#2C5D4F' }}>◆</span>
                bookmarks_untitled
              </div>
              <div className="tab" style={{ top: 150, left: 40, transform: 'rotate(-2deg)' }}>
                <span className="srcico" style={{ width: 22, height: 22, fontSize: 11, background: 'rgba(181,98,60,.12)', color: '#B5623C' }}>✦</span>
                ChatGPT history
              </div>
              <div className="tab" style={{ bottom: 96, right: 24, transform: 'rotate(5deg)' }}>
                📄 notes-final-v3.md
              </div>
              <div className="tab" style={{ bottom: 20, left: 18, transform: 'rotate(-3deg)', borderColor: 'rgba(181,98,60,.4)', background: '#FBF3EE' }}>
                <span className="pull clay" style={{ fontSize: 19 }}>&quot;…where was it?&quot;</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 64, textAlign: 'center', borderTop: '1px solid rgba(27,26,22,.1)', paddingTop: 52 }}>
            <p className="pull" style={{ maxWidth: 820, margin: '0 auto' }}>
              <span className="clay">&quot;</span>There was an amazing explanation of consistent hashing…{' '}
              <span className="dim">where was it?</span>
              <span className="clay">&quot;</span>
            </p>
          </div>
        </div>
      </div>

      {/* ---------------- 03 The solution ---------------- */}
      <div className="sec divide" id="solution">
        <div className="wrap">
          <div className="plate">
            <span className="platenum">03</span>
            <span className="label" style={{ color: '#7C8A7E' }}>The solution</span>
            <span className="plateline" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'start' }}>
            <div style={{ position: 'sticky', top: 100 }}>
              <h2 className="serif" style={{ fontSize: 46 }}>
                One workspace for
                <br />
                everything you learn.
              </h2>
              <p className="dim" style={{ fontSize: 18.5, margin: '26px 0 20px' }}>
                Atlas isn&apos;t another notebook. It&apos;s a learning memory
                that captures, understands, and connects everything you study
                — automatically.
              </p>
              <p className="dim" style={{ fontSize: 18.5 }}>
                Instead of scattered saves, you get one{' '}
                <span className="accent" style={{ fontWeight: 600 }}>Learning Space</span>{' '}
                per topic. Every source flows into it automatically. Then AI
                works across all of it at once.
              </p>
              <p style={{ fontFamily: 'Newsreader', fontStyle: 'italic', fontSize: 23, marginTop: 28, lineHeight: 1.4 }}>
                It&apos;s the difference between a folder of files and a
                brain that actually remembers.
              </p>
            </div>
            <div className="card" style={{ padding: '28px 30px' }}>
              <div className="label" style={{ marginBottom: 18 }}>Ask your own knowledge</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="bubble" style={{ borderLeft: '2px solid #2C5D4F' }}>
                  &quot;Explain caching based on everything I&apos;ve studied.&quot;
                </div>
                <div className="bubble" style={{ borderLeft: '2px solid #B5623C' }}>
                  &quot;What concepts have I not covered yet?&quot;
                </div>
                <div className="bubble" style={{ borderLeft: '2px solid #2C5D4F' }}>
                  &quot;Summarize only what I highlighted.&quot;
                </div>
              </div>
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(27,26,22,.1)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <span className="chip">🎬 videos</span>
                <span className="chip">📰 articles</span>
                <span className="chip">✦ AI chats</span>
                <span className="chip">◆ PDFs</span>
                <span className="chip">✎ your notes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- 04 How it works ---------------- */}
      <div className="sec divide" id="how">
        <div className="wrap">
          <div className="plate">
            <span className="platenum">04</span>
            <span className="label" style={{ color: '#7C8A7E' }}>How it works</span>
            <span className="plateline" />
          </div>
          <h2 className="serif" style={{ fontSize: 46, marginBottom: 14 }}>Three steps, zero friction.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 48, marginTop: 56 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} className="step">
                <div className="stepbar" style={i === STEPS.length - 1 ? { right: 'auto', width: 0 } : undefined} />
                <div className="stepnum">{s.n}</div>
                <h3 className="serif" style={{ fontSize: 28, marginBottom: 12 }}>{s.title}</h3>
                <p className="dim" style={{ fontSize: 16.5 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- 05 Core features ---------------- */}
      <div className="sec divide" id="features">
        <div className="wrap">
          <div className="plate">
            <span className="platenum">05</span>
            <span className="label" style={{ color: '#7C8A7E' }}>Core features</span>
            <span className="plateline" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 20, marginBottom: 44 }}>
            <h2 className="serif" style={{ fontSize: 46 }}>What Atlas does for you.</h2>
            <p className="dim" style={{ maxWidth: 380, fontSize: 16.5 }}>
              Every feature exists to make studying smooth: effortless to
              save, impossible to lose, and built to make things actually
              stick.
            </p>
          </div>
          <div className="fgrid">
            {FEATURES_MAIN.map((f) => (
              <div key={f.n} className="fcell">
                <div className="fnum">{f.n}</div>
                <h3 className="ft">{f.title}</h3>
                <p className="dim" style={{ fontSize: 16 }}>{f.body}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 32, marginTop: 32 }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="win-bar">
                <span className="tl" style={{ background: '#E0A03A' }} />
                <span className="tl" style={{ background: '#7FA88C' }} />
                <span className="tl" style={{ background: '#C97A5A' }} />
                <span className="mono" style={{ marginLeft: 8, fontSize: 12, color: '#9AA69C' }}>
                  youtube.com · Kafka Internals
                </span>
              </div>
              <div style={{ display: 'flex' }}>
                <div style={{ flex: 1, padding: 26, background: '#EDEAE0' }}>
                  <div style={{ height: 12, width: '70%', background: 'rgba(27,26,22,.12)', borderRadius: 3, marginBottom: 12 }} />
                  <div className="mono" style={{ height: 170, background: 'rgba(27,26,22,.16)', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9AA69C' }}>
                    ▶ video
                  </div>
                </div>
                <div style={{ width: 230, padding: 22, borderLeft: '1px solid rgba(27,26,22,.1)', background: '#FBFAF6' }}>
                  <div className="label" style={{ fontSize: 10.5, marginBottom: 16 }}>Atlas · while you browse</div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                    <svg width="112" height="112" viewBox="0 0 112 112">
                      <circle className="ring-track" cx="56" cy="56" r="50" />
                      <circle className="ring-val" cx="56" cy="56" r="50" />
                      <text x="56" y="52" textAnchor="middle" fontFamily="Newsreader" fontSize="30" fill="#1B1A16">70%</text>
                      <text x="56" y="70" textAnchor="middle" fontFamily="IBM Plex Mono" fontSize="9" fill="#7C8A7E" letterSpacing="1">KNOWN</text>
                    </svg>
                  </div>
                  <p style={{ fontSize: 13.5, color: '#4A4941', textAlign: 'center' }}>
                    You already know 70% of this — here&apos;s the{' '}
                    <span className="accent" style={{ fontWeight: 600 }}>30% that&apos;s new.</span>
                  </p>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="fcell" style={{ border: '1px solid rgba(27,26,22,.12)', borderRadius: 6, padding: '28px 30px' }}>
                <div className="fnum">F7</div>
                <h3 className="ft" style={{ fontSize: 22 }}>Learn while you browse</h3>
                <p className="dim" style={{ fontSize: 15.5 }}>
                  Open a new video and Atlas already knows what you&apos;ve
                  studied. A side panel tells you what&apos;s new, so you
                  never waste time relearning what you&apos;ve covered.
                </p>
              </div>
              <div className="fcell" style={{ border: '1px solid rgba(27,26,22,.12)', borderRadius: 6, padding: '28px 30px' }}>
                <div className="fnum">F8</div>
                <h3 className="ft" style={{ fontSize: 22 }}>Review that makes it stick</h3>
                <p className="dim" style={{ fontSize: 15.5 }}>
                  Quizzes, flashcards, and spaced repetition from your own
                  material — weighted toward your weakest concepts, surfaced
                  right before you&apos;d forget them.
                </p>
              </div>
            </div>
          </div>
          <div className="fgrid" style={{ marginTop: 32 }}>
            <div className="fcell">
              <div className="fnum">F9</div>
              <h3 className="ft">Pick up where you left off</h3>
              <p className="dim" style={{ fontSize: 16 }}>
                Open your browser tomorrow and see exactly where you were:
                what you watched, read, and asked — with a single
                &quot;continue&quot; to jump back in. No more &quot;where was
                I?&quot;
              </p>
            </div>
            <div className="fcell">
              <div className="fnum">F10</div>
              <h3 className="ft">Your learning timeline</h3>
              <p className="dim" style={{ fontSize: 16 }}>
                Replay how you learned any topic over days or weeks — the
                videos, the articles, the questions, the breakthroughs. Your
                entire learning journey, in one place.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- 06 Why it's different ---------------- */}
      <div className="sec divide" id="why">
        <div className="wrap">
          <div className="plate">
            <span className="platenum">06</span>
            <span className="label" style={{ color: '#7C8A7E' }}>Why it&apos;s different</span>
            <span className="plateline" />
          </div>
          <h2 className="serif" style={{ fontSize: 52, textAlign: 'center', maxWidth: 760, margin: '0 auto 12px' }}>
            Not a note app. <span className="it accent">A memory.</span>
          </h2>
          <p className="dim" style={{ textAlign: 'center', maxWidth: 560, margin: '0 auto 52px', fontSize: 18 }}>
            Other tools help you save information. Atlas helps you remember
            it — and understand it over time.
          </p>
          <div className="crow">
            <div className="ccol">
              <div className="label clay" style={{ marginBottom: 8 }}>Most tools</div>
              <h3 className="serif" style={{ fontSize: 26, marginBottom: 8 }}>Store &amp; search.</h3>
              <div className="cli"><span className="dim">○</span><span className="dim">Give you somewhere to put things</span></div>
              <div className="cli"><span className="dim">○</span><span className="dim">A folder of files you have to organize</span></div>
              <div className="cli"><span className="dim">○</span><span className="dim">Built around a single document</span></div>
              <div className="cli"><span className="dim">○</span><span className="dim">Remembers what you saved</span></div>
            </div>
            <div className="ccol" style={{ background: '#F0F3F0' }}>
              <div className="label accent" style={{ marginBottom: 8 }}>Atlas</div>
              <h3 className="serif accent" style={{ fontSize: 26, marginBottom: 8 }}>Understand &amp; remember.</h3>
              <div className="cli" style={{ borderColor: 'rgba(44,93,79,.15)' }}><span className="accent">●</span><span>Understands what you&apos;ve learned</span></div>
              <div className="cli" style={{ borderColor: 'rgba(44,93,79,.15)' }}><span className="accent">●</span><span>Connects learning across every source</span></div>
              <div className="cli" style={{ borderColor: 'rgba(44,93,79,.15)' }}><span className="accent">●</span><span>Tracks what you actually know</span></div>
              <div className="cli" style={{ borderColor: 'rgba(44,93,79,.15)' }}><span className="accent">●</span><span>Built for learning over months, not minutes</span></div>
            </div>
          </div>
          <p style={{ textAlign: 'center', fontFamily: 'Newsreader', fontSize: 26, lineHeight: 1.4, maxWidth: 720, margin: '52px auto 0' }}>
            The promise isn&apos;t &quot;take notes while you learn.&quot; It&apos;s:{' '}
            <span className="it accent">never lose anything you learn online again</span>{' '}
            — and instantly recall or connect it whenever you need.
          </p>
        </div>
      </div>

      {/* ---------------- 07 Who it's for ---------------- */}
      <div className="sec divide" id="who">
        <div className="wrap">
          <div className="plate">
            <span className="platenum">07</span>
            <span className="label" style={{ color: '#7C8A7E' }}>Who it&apos;s for</span>
            <span className="plateline" />
          </div>
          <h2 className="serif" style={{ fontSize: 46, marginBottom: 44 }}>Built for people who learn online.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            {AUDIENCE.map((a) => (
              <div key={a.title} className="acard">
                <div className="ficon" style={{ fontSize: 26 }}>{a.icon}</div>
                <h3 className="serif" style={{ fontSize: 22, marginBottom: 10 }}>{a.title}</h3>
                <p className="dim" style={{ fontSize: 15 }}>{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- 08 In their words ---------------- */}
      <div className="sec divide" id="proof">
        <div className="wrap">
          <div className="plate">
            <span className="platenum">08</span>
            <span className="label" style={{ color: '#7C8A7E' }}>In their words</span>
            <span className="plateline" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            <div className="card" style={{ padding: '40px 42px' }}>
              <p className="quote">&quot;I stopped re-watching videos I&apos;d already seen. It just tells me what&apos;s new.&quot;</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 26 }}>
                <div className="mono dim" style={{ width: 42, height: 42, borderRadius: '50%', background: '#E0DCCF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>[Name]</div>
                  <div className="mono" style={{ fontSize: 12, color: '#9AA69C' }}>[role]</div>
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: '40px 42px' }}>
              <p className="quote">&quot;It&apos;s the first tool that actually remembers what I&apos;ve learned, not just what I saved.&quot;</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 26 }}>
                <div className="mono dim" style={{ width: 42, height: 42, borderRadius: '50%', background: '#E0DCCF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>[Name]</div>
                  <div className="mono" style={{ fontSize: 12, color: '#9AA69C' }}>[role]</div>
                </div>
              </div>
            </div>
          </div>
          <p className="mono" style={{ fontSize: 12, color: '#9AA69C', marginTop: 20, textAlign: 'center' }}>
            Placeholder testimonials — swap in real quotes as you gather them.
          </p>
        </div>
      </div>

      {/* ---------------- 09 FAQ ---------------- */}
      <div className="sec divide" id="faq">
        <div className="wrap" style={{ maxWidth: 900 }}>
          <div className="plate">
            <span className="platenum">09</span>
            <span className="label" style={{ color: '#7C8A7E' }}>FAQ</span>
            <span className="plateline" />
          </div>
          <h2 className="serif" style={{ fontSize: 46, marginBottom: 40 }}>Questions people will ask.</h2>
          <div className="faq">
            {FAQS.map((f, i) => (
              <details
                key={f.q}
                open={f.open}
                style={i === FAQS.length - 1 ? { borderBottom: '1px solid rgba(27,26,22,.14)' } : undefined}
              >
                <summary>
                  {f.q}
                  <span className="plus">+</span>
                </summary>
                <p className="ans">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- 10 Final CTA ---------------- */}
      <div className="sec" id="cta" style={{ paddingBottom: 120 }}>
        <div className="wrap">
          <div className="ctaband" style={{ padding: '84px 64px', textAlign: 'center' }}>
            <Contour dark style={{ opacity: 0.22 }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <span className="label" style={{ color: '#7FA88C' }}>Section 10 · get started</span>
              <h2 className="serif" style={{ fontSize: 56, margin: '20px 0 18px', maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
                Turn everything you learn <span className="it" style={{ color: '#9DC3AC' }}>into memory.</span>
              </h2>
              <p style={{ color: '#C9C6BC', fontSize: 19, maxWidth: 520, margin: '0 auto 36px' }}>
                Stop losing what you study. Start building a learning memory
                that grows with you — your first Learning Space in minutes.
              </p>
              {/* Final CTA buttons */}
              <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <a href="/signup" className="btn btn-p" style={{ background: '#9DC3AC', color: '#16241E' }}>
                  Get started free <span className="arrow">→</span>
                </a>
                <a href="/login" className="btn btn-g" style={{ color: '#F4F1E9', borderColor: 'rgba(244,241,233,.32)' }}>
                  Log in
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- Footer ---------------- */}
      <footer className="divide">
        <div className="wrap" style={{ padding: '44px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
          <a href="/" className="brand" style={{ fontSize: 19 }}>
            <Glyph size={22} />
            <span className="wordmark">
              atlas<span className="accent">.ai</span>
            </span>
          </a>
          <div style={{ display: 'flex', gap: 28 }}>
            <a className="footlink" href="#features">Features</a>
            <a className="footlink" href="#how">How it works</a>
            <a className="footlink" href="#faq">FAQ</a>
            <a className="footlink" href="/login">Log in</a>
            <a className="footlink" href="/signup">Start free</a>
          </div>
          <span className="mono" style={{ fontSize: 12, color: '#9AA69C' }}>
            © {new Date().getFullYear()} Atlas.ai · Your AI learning memory
          </span>
        </div>
      </footer>
    </>
  );
}