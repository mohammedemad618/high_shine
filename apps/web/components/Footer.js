import Link from 'next/link';
import { SITE_NAME, whatsappUrl } from '@/lib/config';
import { fetchAppConfig } from '@/lib/server-api';
import styles from './Footer.module.css';

/** Server component: the support number comes from /app-config (cached), so it can change without a deploy. */
export default async function Footer() {
  const { data: config } = await fetchAppConfig();
  const support = whatsappUrl(config?.supportWhatsapp);

  return (
    <footer className="site-footer">
      <div className={`container ${styles.bar}`}>
        <span>
          © {new Date().getFullYear()} {SITE_NAME}
        </span>
        <nav className={styles.links} aria-label="روابط الموقع">
          <Link href="/privacy">سياسة الخصوصية</Link>
          <Link href="/terms">شروط الاستخدام</Link>
          {support && (
            <a href={support} target="_blank" rel="noopener noreferrer">
              الدعم عبر واتساب
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}
