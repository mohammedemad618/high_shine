import Link from 'next/link';
import CourseCard from '@/components/CourseCard';
import { fetchCourses } from '@/lib/server-api';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/config';
import styles from './page.module.css';

const PAGE_SIZE = 24;

export async function generateMetadata({ searchParams }) {
  const { q } = await searchParams;
  return q ? { title: `بحث: ${q}`, robots: { index: false } } : { title: { absolute: SITE_NAME } };
}

export default async function HomePage({ searchParams }) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 100) : '';
  const page = Math.max(1, Number.parseInt(sp.page, 10) || 1);

  const { data, error } = await fetchCourses({ q, page, limit: PAGE_SIZE });
  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const pageHref = (p) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (p > 1) params.set('page', String(p));
    const s = params.toString();
    return s ? `/?${s}` : '/';
  };

  return (
    <>
      <section className={styles.hero}>
        <div className="container">
          <h1 className={styles.heroTitle}>تعلّم مع أفضل المدرسين</h1>
          <p className={styles.heroText}>{SITE_DESCRIPTION}</p>
          <form action="/" method="get" className={styles.search} role="search">
            <label htmlFor="q" className="sr-only">
              ابحث عن كورس
            </label>
            <input
              id="q"
              name="q"
              type="search"
              className="input"
              placeholder="ابحث عن كورس أو مادة…"
              defaultValue={q}
              maxLength={100}
            />
            <button type="submit" className="btn btn-primary">
              بحث
            </button>
          </form>
        </div>
      </section>

      <div className="container page">
        <div className={styles.listHeader}>
          <h2 className={styles.listTitle}>{q ? `نتائج البحث عن "${q}"` : 'الكورسات المتاحة'}</h2>
          {q && (
            <Link href="/" className="btn btn-secondary btn-sm">
              عرض كل الكورسات
            </Link>
          )}
        </div>

        {error ? (
          <div className="empty-state card">تعذّر تحميل الكورسات الآن، حاول بعد قليل.</div>
        ) : items.length === 0 ? (
          <div className="empty-state card">{q ? 'لا توجد كورسات مطابقة لبحثك.' : 'لا توجد كورسات منشورة بعد.'}</div>
        ) : (
          <div className={styles.grid}>
            {items.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav className={styles.pager} aria-label="الصفحات">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="btn btn-secondary btn-sm">
                السابق
              </Link>
            )}
            <span className="muted">
              صفحة {page} من {totalPages}
            </span>
            {page < totalPages && (
              <Link href={pageHref(page + 1)} className="btn btn-secondary btn-sm">
                التالي
              </Link>
            )}
          </nav>
        )}
      </div>
    </>
  );
}
