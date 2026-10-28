import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { keys } from '../api/hooks.js';
import { EmptyState, ErrorBox, Spinner, StatTile } from '../components/ui.jsx';
import { fmtNumber } from '../lib/format.js';

export default function CourseStatsPage() {
  const { id } = useParams();
  const course = useQuery({ queryKey: keys.course(id), queryFn: () => api(`/courses/${id}`) });
  const stats = useQuery({ queryKey: keys.courseStats(id), queryFn: () => api(`/courses/${id}/stats`) });

  const lessons = stats.data?.lessons ?? [];
  const maxViewers = Math.max(1, ...lessons.map((l) => l.viewers));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to={`/courses/${id}`} className="back-link">
            → العودة إلى الكورس
          </Link>
          <h1>إحصائيات: {course.data?.course.title ?? '…'}</h1>
        </div>
      </div>

      {stats.isPending && <Spinner />}
      <ErrorBox error={stats.error} onRetry={() => stats.refetch()} />

      {stats.data && (
        <>
          <div className="tiles">
            <StatTile label="الاشتراكات الفعّالة" value={fmtNumber(stats.data.activeEnrollments)} />
            <StatTile label="ساعات المشاهدة" value={fmtNumber(stats.data.watchHours)} />
            <StatTile label="عدد الدروس" value={fmtNumber(lessons.length)} />
          </div>

          <section className="card">
            <h2 className="card-title">الدروس</h2>
            {!lessons.length ? (
              <EmptyState>لا توجد دروس بعد.</EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>الدرس</th>
                      <th>المشاهدون</th>
                      <th>أكملوا الدرس</th>
                      <th>نسبة الإكمال</th>
                      <th>ساعات المشاهدة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lessons.map((l) => (
                      <tr key={l.id}>
                        <td>{l.title}</td>
                        <td>
                          <div className="bar-cell">
                            <span className="bar" style={{ width: `${(l.viewers / maxViewers) * 100}%` }} />
                            <span>{fmtNumber(l.viewers)}</span>
                          </div>
                        </td>
                        <td>{fmtNumber(l.completions)}</td>
                        <td>{l.viewers ? `${Math.round((l.completions / l.viewers) * 100)}%` : '—'}</td>
                        <td>{fmtNumber(l.watchHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
