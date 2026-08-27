import Link from 'next/link';
import { Lockup } from '@/components/brand/Lockup';
import ThemeToggle from '../dashboard/ThemeToggle';
import { NAV_LINKS } from './data';
import styles from './marketing.module.css';

export function Nav() {
  return (
    <div className={styles.nav}>
      <div className={`${styles.wrap} ${styles.navin}`}>
        <Link href="/" className={styles.brand}>
          <Lockup size={26} />
        </Link>
        <nav className={styles.navlinks}>
          {NAV_LINKS.map((l) => (
            <a key={l.label} className={styles.navlink} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className={styles.navActions}>
          <ThemeToggle />
          <a href="/login" className={`${styles.btn} ${styles.btnG} ${styles.btnSm}`}>
            Log in
          </a>
          <a href="/signup" className={`${styles.btn} ${styles.btnP} ${styles.btnSm}`}>
            Start free
          </a>
        </div>
      </div>
    </div>
  );
}
