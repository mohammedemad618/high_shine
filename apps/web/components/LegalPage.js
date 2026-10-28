import { formatDate } from '@/lib/format';
import styles from './LegalPage.module.css';

/** Shared frame for the privacy policy and the terms: one readable column with the date of the last change. */
export default function LegalPage({ title, updatedAt, children }) {
  return (
    <div className="container page">
      <article className={`card ${styles.doc}`}>
        <header className={styles.head}>
          <h1 className={styles.title}>{title}</h1>
          <p className="muted">آخر تحديث: {formatDate(updatedAt)}</p>
        </header>
        {children}
      </article>
    </div>
  );
}
