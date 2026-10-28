import { notFound } from 'next/navigation';
import { fetchCourse } from '@/lib/server-api';
import { SITE_NAME, SITE_URL } from '@/lib/config';
import { excerpt, formatPrice, formatTotalDuration } from '@/lib/format';
import CourseLessons from './CourseLessons';
import styles from './course.module.css';

// Public data is cached for a minute; per-student state is loaded in the browser by <CourseLessons>.
export const revalidate = 60;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { data } = await fetchCourse(slug);
  if (!data) return { title: 'الكورس غير متاح', robots: { index: false } };

  const { course } = data;
  const description = excerpt(course.description) || `كورس ${course.title} على ${SITE_NAME}`;
  const images = course.coverUrl ? [{ url: course.coverUrl, alt: course.title }] : undefined;
  return {
    title: course.title,
    description,
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: {
      type: 'website',
      title: course.title,
      description,
      url: `/courses/${course.slug}`,
      images,
    },
    twitter: { card: images ? 'summary_large_image' : 'summary', title: course.title, description, images },
  };
}

export default async function CoursePage({ params }) {
  const { slug } = await params;
  const { data, notFound: missing } = await fetchCourse(slug);
  if (missing) notFound();
  if (!data) {
    return (
      <div className="container page">
        <div className="empty-state card">تعذّر تحميل الكورس الآن، حاول بعد قليل.</div>
      </div>
    );
  }

  const { course, sections } = data;
  const lessonsCount = sections.reduce((n, s) => n + s.lessons.length, 0);
  const duration = formatTotalDuration(course.stats?.totalDurationSec);
  const price = formatPrice(course.priceIqd);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: excerpt(course.description, 500) || course.title,
    url: `${SITE_URL}/courses/${course.slug}`,
    inLanguage: 'ar',
    ...(course.coverUrl ? { image: course.coverUrl } : {}),
    provider: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    ...(course.teacher?.name ? { instructor: { '@type': 'Person', name: course.teacher.name } } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify output with "<" escaped cannot break out of the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroText}>
            <h1 className={styles.title}>{course.title}</h1>
            {course.teacher?.name && <p className={styles.teacher}>المدرّس: {course.teacher.name}</p>}
            <ul className={styles.facts}>
              <li>{lessonsCount} درس</li>
              {duration && <li>{duration}</li>}
              {price && <li>{price}</li>}
            </ul>
          </div>
          {course.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.coverUrl} alt={course.title} className={styles.cover} />
          )}
        </div>
      </section>

      <div className={`container page ${styles.layout}`}>
        <div className={styles.main}>
          {course.description && (
            <section className={`card ${styles.description}`}>
              <h2 className={styles.sectionHeading}>عن الكورس</h2>
              <p>{course.description}</p>
            </section>
          )}
          <CourseLessons slug={course.slug} initial={data} />
        </div>
      </div>
    </>
  );
}
