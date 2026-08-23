import Link from 'next/link';

import { Lockup } from '@/components/brand/Lockup';
import { NAV_LINKS } from './data';

export function Nav() {
  return (
    <div className="nav">
      <div className="wrap navin">
        <Link href="/" className="brand">
          <Lockup size={26} />
        </Link>
        <nav className="navlinks">
          {NAV_LINKS.map((l) => (
            <a key={l.label} className="navlink" href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center [gap:10px]">
          <a href="/login" className="btn btn-g btn-sm">
            Log in
          </a>
          <a href="/signup" className="btn btn-p btn-sm">
            Start free
          </a>
        </div>
      </div>
    </div>
  );
}
