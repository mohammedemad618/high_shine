import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { keys } from '../../api/hooks.js';
import { ErrorBox, Spinner, StatTile } from '../../components/ui.jsx';
import { fmtNumber } from '../../lib/format.js';

export default function AdminDashboardPage() {
  const stats = useQuery({ queryKey: keys.adminStats, queryFn: () => api('/admin/stats'), refetchInterval: 60_000 });
  const s = stats.data;

  return (
    <div className="page">
      <div className="page-header">
        <h1>الإحصائيات العامة</h1>
      </div>
      {stats.isPending && <Spinner />}
      <ErrorBox error={stats.error} onRetry={() => stats.refetch()} />
      {s && (
        <div className="tiles">
          <StatTile label="الطلاب" value={fmtNumber(s.students)} />
          <StatTile label="المدرّسون" value={fmtNumber(s.teachers)} />
          <StatTile label="الكورسات" value={fmtNumber(s.courses)} sub={`${fmtNumber(s.publishedCourses)} منشور`} />
          <StatTile label="الدروس" value={fmtNumber(s.lessons)} />
          <StatTile label="الاشتراكات الفعّالة" value={fmtNumber(s.activeEnrollments)} />
          <StatTile label="ساعات المشاهدة" value={fmtNumber(s.watchHours)} />
          <StatTile
            label="أكواد التفعيل"
            value={fmtNumber(s.codes.total)}
            sub={`${fmtNumber(s.codes.redeemed)} مرة استخدام`}
          />
        </div>
      )}
    </div>
  );
}
