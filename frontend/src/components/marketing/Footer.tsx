import Link from 'next/link';

import { Glyph } from './Glyph';

export function Footer() {
  return (
    <footer className="divide">
      <div className="wrap footer-row">
        <Link href="/" className="brand brand-sm">
          <Glyph size={22} />
          <span className="wordmark">
            atlas<span className="accent">.ai</span>
          </span>
        </Link>
        <div className="footer-links">
          <a className="footlink" href="#features">Features</a>
          <a className="footlink" href="#how">How it works</a>
          <a className="footlink" href="#faq">FAQ</a>
          <a className="footlink" href="/login">Log in</a>
          <a className="footlink" href="/signup">Start free</a>
        </div>
        <span className="mono [font-size:12px] [color:#9AA69C]">
          © {new Date().getFullYear()} Atlas.ai · Your AI learning memory
        </span>
      </div>
    </footer>
  );
}
