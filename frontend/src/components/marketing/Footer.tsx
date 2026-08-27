import Link from 'next/link';
import { Lockup } from '@/components/brand/Lockup';
import styles from './marketing.module.css';

export function Footer() {
  return (
    <footer className={styles.divide}>
      <div className={`${styles.wrap} ${styles.footerRow}`}>
        <Link href="/" className={`${styles.brand} ${styles.brandSm}`}>
          <Lockup size={22} />
        </Link>
        <div className={styles.footerLinks}>
          <a className={styles.footlink} href="#map">Knowledge map</a>
          <a className={styles.footlink} href="#notes">Notes</a>
          <a className={styles.footlink} href="#features">Features</a>
          <a className={styles.footlink} href="#how">How it works</a>
          <a className={styles.footlink} href="#faq">FAQ</a>
          <a className={styles.footlink} href="/login">Log in</a>
          <a className={styles.footlink} href="/signup">Start free</a>
        </div>
        <span className={`${styles.mono} ${styles.footerCopy}`}>
          © {new Date().getFullYear()} exomemri · Your AI learning memory
        </span>
      </div>
    </footer>
  );
}
