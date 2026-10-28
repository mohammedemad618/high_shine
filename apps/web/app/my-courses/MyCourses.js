'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ROLES } from '@lp/shared';
import CourseCard from '@/components/CourseCard';
import RequireAuth from '@/components/RequireAuth';
import { useAuth } from '@/components/AuthProvider';
import { api, errorText } from '@/lib/api';
import { formatDate } from '@/lib/format';
import styles from './my-courses.module.css';

export default function MyCourses() {
  return (
    <RequireAuth>
      <div className="container page">
        <h1 className="page-title">كورساتي</h1>
        <MyCoursesList />
      </div>
    </RequireAuth>
  );
}

function MyCoursesList() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, items: [], error: '' });
  const isStudent = user.role === ROLES.STUDENT;

  useEffect(() => {
    if (!isStudent) return undefined;
    const ctrl = new AbortController();
    api('/me/courses', { signal: ctrl.signal })
      .then((data) => setState({ loading: false, items: data.items, error: '' }))
      .catch((err) => {
        if (err?.name !== 'AbortError') setState({ loading: false, items: [], error: errorText(err) });
      });
    return () => ctrl.abort();
  }, [isStudent]);

  if (!isStudent) {
    return <div className="empty-state card">هذه الصفحة للطلاب. استخدم لوحة الإدارة لإدارة كورساتك.</div>;
  }
  if (state.loading) {
    return (
      <div className="center-state">
        <span className="spinner" aria-label="جارٍ التحميل" />
      </div>
    );
  }
  if (state.error) return <div className="alert alert-error">{state.error}</div>;
  if (state.items.length === 0) {
    return (
      <div className="empty-state card">
        <p>لم تفعّل أي كورس بعد.</p>
        <div className={styles.emptyActions}>
          <Link href="/redeem" className="btn btn-primary">
            تفعيل كود
          </Link>
          <Link href="/" className="btn btn-secondary">
            تصفّح الكورسات
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {state.items.map(({ course, enrollment, completedLessons, totalLessons, percent, continueLesson }) => (
        <CourseCard
          key={course.id}
          course={course}
          footer={
            <div className={styles.progress}>
              <div className="progress-bar" aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </div>
              <p className={styles.progressText}>
                أكملت {completedLessons} من {totalLessons} درس ({percent}%)
              </p>
              {enrollment.expiresAt && (
                <p className={styles.expires}>ينتهي الاشتراك في {formatDate(enrollment.expiresAt)}</p>
              )}
              {continueLesson ? (
                <Link href={`/watch/${continueLesson.id}`} className="btn btn-primary btn-block">
                  متابعة: {continueLesson.title || 'آخر درس'}
                </Link>
              ) : (
                <Link href={`/courses/${course.slug}`} className="btn btn-primary btn-block">
                  ابدأ الكورس
                </Link>
              )}
            </div>
          }
        />
      ))}
    </div>
  );
}
