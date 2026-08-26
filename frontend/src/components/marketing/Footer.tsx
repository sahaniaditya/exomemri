import Link from 'next/link';
import { Lockup } from '@/components/brand/Lockup';

export function Footer() {
  return (
    <footer className="divide">
      <div className="wrap footer-row">
        <Link href="/" className="brand brand-sm">
          <Lockup size={22} />
        </Link>
        <div className="footer-links">
          <a className="footlink" href="#features">Features</a>
          <a className="footlink" href="#how">How it works</a>
          <a className="footlink" href="#faq">FAQ</a>
          <a className="footlink" href="/login">Log in</a>
          <a className="footlink" href="/signup">Start free</a>
        </div>
        <span className="mono footer-copy">
          © {new Date().getFullYear()} exomemri · Your AI learning memory
        </span>
      </div>
    </footer>
  );
}