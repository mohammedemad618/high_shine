import Link from 'next/link';
import { formatPrice, formatTotalDuration } from '@/lib/format';
import styles from './CourseCard.module.css';

/** Card for a CourseSummary. `footer` lets a page add its own row (e.g. progress on "my courses"). */
export default function CourseCard({ course, href, footer }) {
  const link = href || `/courses/${course.slug}`;
  const duration = formatTotalDuration(course.stats?.totalDurationSec);
  const price = formatPrice(course.priceIqd);

  return (
    <article className={`card ${styles.card}`}>
      <Link href={link} className={styles.coverLink} tabIndex={-1} aria-hidden="true">
        {course.coverUrl ? (
          // Plain <img>: the media domain is configurable per deployment.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.coverUrl} alt="" className={styles.cover} loading="lazy" />
        ) : (
          <div className={styles.placeholder}>{course.title?.trim()?.[0]}</div>
        )}
      </Link>
      <div className={styles.body}>
        <h3 className={styles.title}>
          <Link href={link}>{course.title}</Link>
        </h3>
        {course.teacher?.name && <p className={styles.teacher}>{course.teacher.name}</p>}
        <p className={styles.meta}>
          <span>{course.stats?.lessonsCount ?? 0} درس</span>
          {duration && <span>{duration}</span>}
          {price && <span className={styles.price}>{price}</span>}
        </p>
        {footer}
      </div>
    </article>
  );
}
