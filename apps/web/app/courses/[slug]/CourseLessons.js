'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ROLES } from '@lp/shared';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { formatClock, formatDate } from '@/lib/format';
import styles from './course.module.css';

/**
 * Sections and lessons. The first render uses the anonymous server data (indexed by search engines);
 * for a logged-in user the course is re-fetched with the token to get enrollment and watch progress.
 */
export default function CourseLessons({ slug, initial }) {
  const { user, ready } = useAuth();
  const [details, setDetails] = useState(initial);
  const [personalized, setPersonalized] = useState(false);

  useEffect(() => {
    if (!ready) return undefined;
    if (!user) {
      setDetails(initial);
      setPersonalized(false);
      return undefined;
    }
    const ctrl = new AbortController();
    api(`/courses/${encodeURIComponent(slug)}`, { auth: 'optional', signal: ctrl.signal })
      .then((data) => {
        setDetails(data);
        setPersonalized(true);
      })
      .catch(() => {
        // keep the public data; lessons still link to the player, which reports access errors itself
        setPersonalized(true);
      });
    return () => ctrl.abort();
  }, [ready, user, slug, initial]);

  const loggedIn = ready && Boolean(user);
  const enrolled = Boolean(details.enrollment);
  const hasAccess = enrolled || Boolean(details.canManage);
  const isStudent = !user || user.role === ROLES.STUDENT;
  const allLessons = details.sections.flatMap((s) => s.lessons);
  const completedCount = allLessons.filter((l) => l.progress?.completed).length;
  const nextLesson =
    allLessons.find((l) => l.progress && !l.progress.completed) || allLessons.find((l) => !l.progress?.completed) || allLessons[0];

  const canPlay = (lesson) => loggedIn && (hasAccess || lesson.isFreePreview);

  return (
    <>
      <section className={`card ${styles.panel}`} aria-live="polite">
        {!ready || (loggedIn && !personalized) ? (
          <p className="muted">جارٍ التحقق من اشتراكك…</p>
        ) : !loggedIn ? (
          <>
            <p>سجّل الدخول لمشاهدة الدروس المجانية ومتابعة تقدّمك.</p>
            <div className={styles.panelActions}>
              <Link href={`/login?next=${encodeURIComponent(`/courses/${slug}`)}`} className="btn btn-primary">
                تسجيل الدخول
              </Link>
              <Link href="/register" className="btn btn-secondary">
                إنشاء حساب
              </Link>
            </div>
          </>
        ) : hasAccess ? (
          <>
            <p className={styles.enrolled}>
              {enrolled ? '✓ أنت مشترك في هذا الكورس' : 'لديك صلاحية إدارة هذا الكورس'}
              {details.enrollment?.expiresAt && (
                <span className="muted"> — ينتهي الاشتراك في {formatDate(details.enrollment.expiresAt)}</span>
              )}
            </p>
            {enrolled && allLessons.length > 0 && (
              <>
                <div className="progress-bar" aria-hidden="true">
                  <span style={{ width: `${Math.round((completedCount / allLessons.length) * 100)}%` }} />
                </div>
                <p className="muted">
                  أكملت {completedCount} من {allLessons.length} درس
                </p>
              </>
            )}
            {nextLesson && (
              <div className={styles.panelActions}>
                <Link href={`/watch/${nextLesson.id}`} className="btn btn-primary">
                  {completedCount || nextLesson.progress ? 'متابعة المشاهدة' : 'ابدأ المشاهدة'}
                </Link>
              </div>
            )}
          </>
        ) : isStudent ? (
          <>
            <p>هذا الكورس غير مفعّل في حسابك. فعّله بكود التفعيل لمشاهدة كل الدروس.</p>
            <div className={styles.panelActions}>
              <Link href="/redeem" className="btn btn-primary">
                تفعيل الكورس بكود
              </Link>
            </div>
          </>
        ) : (
          <p className="muted">يمكنك مشاهدة الدروس المجانية فقط في هذا الكورس.</p>
        )}
      </section>

      <section className={styles.curriculum}>
        <h2 className={styles.sectionHeading}>محتوى الكورس</h2>
        {details.sections.length === 0 && <div className="empty-state card">لم تُضف دروس بعد.</div>}
        {details.sections.map((section) => (
          <div key={section.id} className={`card ${styles.section}`}>
            <h3 className={styles.sectionTitle}>
              {section.title}
              <span className="muted"> · {section.lessons.length} درس</span>
            </h3>
            {section.lessons.length === 0 ? (
              <p className={`muted ${styles.noLessons}`}>لا توجد دروس جاهزة في هذا القسم بعد.</p>
            ) : (
              <ol className={styles.lessons}>
                {section.lessons.map((lesson) => (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    playable={canPlay(lesson)}
                    needsLogin={ready && !loggedIn && lesson.isFreePreview}
                  />
                ))}
              </ol>
            )}
          </div>
        ))}
      </section>
    </>
  );
}

function LessonRow({ lesson, playable, needsLogin }) {
  const { progress } = lesson;
  const watchedPct =
    progress && lesson.durationSec ? Math.min(100, Math.round((progress.positionSec / lesson.durationSec) * 100)) : 0;

  const content = (
    <>
      <span className={styles.lessonIcon} aria-hidden="true">
        {progress?.completed ? '✓' : playable || needsLogin ? '▶' : '🔒'}
      </span>
      <span className={styles.lessonTitle}>{lesson.title}</span>
      <span className={styles.lessonBadges}>
        {lesson.isFreePreview && <span className="badge badge-free">مجاني</span>}
        {progress?.completed ? (
          <span className="badge badge-done">مكتمل</span>
        ) : progress ? (
          <span className="badge badge-progress">شاهدت {watchedPct}%</span>
        ) : null}
        {lesson.attachmentsCount > 0 && <span className="muted">📎 {lesson.attachmentsCount}</span>}
      </span>
      {lesson.durationSec ? <span className={styles.duration}>{formatClock(lesson.durationSec)}</span> : null}
    </>
  );

  if (playable) {
    return (
      <li>
        <Link href={`/watch/${lesson.id}`} className={`${styles.lesson} ${styles.playable}`}>
          {content}
        </Link>
      </li>
    );
  }
  if (needsLogin) {
    return (
      <li>
        <Link href={`/login?next=${encodeURIComponent(`/watch/${lesson.id}`)}`} className={`${styles.lesson} ${styles.playable}`}>
          {content}
        </Link>
      </li>
    );
  }
  return (
    <li className={`${styles.lesson} ${styles.locked}`} title="الدرس متاح للمشتركين">
      {content}
    </li>
  );
}
