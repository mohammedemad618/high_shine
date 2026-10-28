'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { SITE_NAME } from '@/lib/config';
import styles from './Header.module.css';

function NavLink({ href, children }) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link href={href} className={active ? `${styles.link} ${styles.active}` : styles.link}>
      {children}
    </Link>
  );
}

export default function Header() {
  const { user, ready } = useAuth();

  return (
    <header className={styles.header}>
      <div className={`container ${styles.bar}`}>
        <Link href="/" className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            ▶
          </span>
          {SITE_NAME}
        </Link>

        <nav className={styles.nav} aria-label="القائمة الرئيسية">
          <NavLink href="/">الكورسات</NavLink>
          {ready && user && (
            <>
              <NavLink href="/my-courses">كورساتي</NavLink>
              <NavLink href="/redeem">تفعيل كود</NavLink>
            </>
          )}
        </nav>

        <div className={styles.account}>
          {!ready ? null : user ? (
            <Link href="/account" className={styles.user} title="حسابي">
              <span className={styles.avatar} aria-hidden="true">
                {user.name?.trim()?.[0] || '؟'}
              </span>
              <span className={styles.userName}>{user.name}</span>
            </Link>
          ) : (
            <>
              <Link href="/login" className={styles.link}>
                تسجيل الدخول
              </Link>
              <Link href="/register" className="btn btn-primary btn-sm">
                إنشاء حساب
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
