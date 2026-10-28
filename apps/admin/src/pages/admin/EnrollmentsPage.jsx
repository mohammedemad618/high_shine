import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { keys, useMyCourses } from '../../api/hooks.js';
import EnrollmentActions, { EnrollmentExpiry, SOURCE_LABELS, enrollmentState } from '../../components/EnrollmentActions.jsx';
import { EmptyState, ErrorBox, Pagination, Spinner } from '../../components/ui.jsx';
import { fmtDate } from '../../lib/format.js';

export default function EnrollmentsPage() {
  const courses = useMyCourses();
  const [courseId, setCourseId] = useState('');
  const [page, setPage] = useState(1);
  const params = { courseId: courseId || undefined, page, limit: 20 };
  const list = useQuery({
    queryKey: keys.enrollments(params),
    queryFn: () => api('/admin/enrollments', { query: params }),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>الاشتراكات</h1>
        <select
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            setPage(1);
          }}
          aria-label="تصفية حسب الكورس"
        >
          <option value="">كل الكورسات</option>
          {courses.data?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {list.isPending && <Spinner />}
      <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      {list.data && <p className="muted">{list.data.total} اشتراك</p>}
      {list.data && !list.data.items.length && <EmptyState>لا توجد اشتراكات.</EmptyState>}
      {list.data?.items.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الطالب</th>
                <th>الكورس</th>
                <th>الحالة</th>
                <th>المصدر</th>
                <th>البداية</th>
                <th>الانتهاء</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((e) => {
                const st = enrollmentState(e);
                return (
                  <tr key={e.id}>
                    <td>
                      {e.user ? (
                        <Link to={`/admin/students/${e.user.id}`}>
                          {e.user.name} <span className="muted small" dir="ltr">{e.user.phone}</span>
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{e.course?.title ?? '—'}</td>
                    <td>
                      <span className={`badge badge-${st.tone}`}>{st.label}</span>
                    </td>
                    <td>{SOURCE_LABELS[e.source] ?? e.source}</td>
                    <td>{fmtDate(e.startsAt)}</td>
                    <td>
                      <EnrollmentExpiry enrollment={e} />
                    </td>
                    <td>
                      <EnrollmentActions enrollment={e} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {list.data && <Pagination page={page} limit={list.data.limit} total={list.data.total} onChange={setPage} />}
    </div>
  );
}
