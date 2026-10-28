import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { USER_STATUS } from '@lp/shared';
import { api } from '../../api/client.js';
import { keys, useMyCourses } from '../../api/hooks.js';
import EnrollmentActions, { EnrollmentExpiry, SOURCE_LABELS, enrollmentState } from '../../components/EnrollmentActions.jsx';
import { EmptyState, ErrorBox, Field, Notice, Spinner, USER_STATUS_LABELS } from '../../components/ui.jsx';
import { fmtDate, fmtDateTime } from '../../lib/format.js';

function useUserMutation(userId, request) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.user(userId) });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['admin', 'enrollments'] });
      qc.invalidateQueries({ queryKey: keys.adminStats });
    },
  });
}

function AccountCard({ user }) {
  const [maxDevices, setMaxDevices] = useState(user.maxDevices);
  const [password, setPassword] = useState('');
  const [passwordDone, setPasswordDone] = useState(false);
  const patch = useUserMutation(user.id, (body) => api(`/admin/users/${user.id}`, { method: 'PATCH', body }));
  const suspended = user.status === USER_STATUS.SUSPENDED;

  return (
    <section className="card">
      <h2 className="card-title">الحساب</h2>
      <ErrorBox error={patch.error} />
      <div className="kv">
        <div>
          <span>الهاتف</span>
          <b dir="ltr">{user.phone}</b>
        </div>
        <div>
          <span>الحالة</span>
          <b>{USER_STATUS_LABELS[user.status] || user.status}</b>
        </div>
        <div>
          <span>تاريخ التسجيل</span>
          <b>{fmtDate(user.createdAt)}</b>
        </div>
      </div>

      {user.status === USER_STATUS.DELETED ? (
        <Notice>حذف الطالب حسابه بنفسه، فلا يمكن تعديله أو إعادة تفعيله. تبقى اشتراكاته معروضة للسجلات فقط.</Notice>
      ) : (
        <div className="actions-grid">
          <button
            type="button"
            className={`btn ${suspended ? 'btn-primary' : 'danger'}`}
            disabled={patch.isPending}
            onClick={() => {
              if (!suspended && !window.confirm('إيقاف الحساب؟ سيُسجَّل خروج الطالب من كل الأجهزة.')) return;
              patch.mutate({ status: suspended ? USER_STATUS.ACTIVE : USER_STATUS.SUSPENDED });
            }}
          >
            {suspended ? 'تفعيل الحساب' : 'إيقاف الحساب'}
          </button>

          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              patch.mutate({ maxDevices: Number(maxDevices) });
            }}
          >
            <Field label="الحد الأقصى للأجهزة">
              <input type="number" min={1} max={10} value={maxDevices} onChange={(e) => setMaxDevices(e.target.value)} required />
            </Field>
            <button type="submit" className="btn btn-sm" disabled={patch.isPending || Number(maxDevices) === user.maxDevices}>
              حفظ
            </button>
          </form>

          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!window.confirm('تعيين كلمة مرور جديدة؟ سيُسجَّل خروج الطالب من كل الأجهزة.')) return;
              patch.mutate(
                { password },
                {
                  onSuccess: () => {
                    setPassword('');
                    setPasswordDone(true);
                  },
                },
              );
            }}
          >
            <Field label="كلمة مرور جديدة" hint={passwordDone ? 'تم تغيير كلمة المرور' : '8 أحرف على الأقل'}>
              <input type="text" dir="ltr" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <button type="submit" className="btn btn-sm" disabled={patch.isPending}>
              تعيين
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

function DevicesCard({ user }) {
  const clear = useUserMutation(user.id, () => api(`/admin/users/${user.id}/devices`, { method: 'DELETE' }));
  return (
    <section className="card">
      <div className="row-between">
        <h2 className="card-title">
          الأجهزة ({user.devices.length}/{user.maxDevices})
        </h2>
        {user.status !== USER_STATUS.DELETED && (
          <button
            type="button"
            className="btn btn-sm danger"
            disabled={clear.isPending || !user.devices.length}
            onClick={() => window.confirm('مسح كل الأجهزة؟ سيُسجَّل خروج الطالب ويمكنه الدخول من أجهزة جديدة.') && clear.mutate()}
          >
            مسح كل الأجهزة
          </button>
        )}
      </div>
      <ErrorBox error={clear.error} />
      {!user.devices.length ? (
        <EmptyState>لا توجد أجهزة مسجّلة.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الجهاز</th>
                <th>النظام</th>
                <th>أُضيف</th>
                <th>آخر ظهور</th>
              </tr>
            </thead>
            <tbody>
              {user.devices.map((d) => (
                <tr key={d.deviceId}>
                  <td>{d.name || d.deviceId.slice(0, 12)}</td>
                  <td>{d.platform}</td>
                  <td>{fmtDateTime(d.addedAt)}</td>
                  <td>{fmtDateTime(d.lastSeenAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function GrantForm({ userId }) {
  const courses = useMyCourses();
  const [courseId, setCourseId] = useState('');
  const [days, setDays] = useState('');
  const grant = useUserMutation(userId, () =>
    api('/admin/enrollments', { method: 'POST', body: { userId, courseId, durationDays: days ? Number(days) : null } }),
  );

  return (
    <form
      className="inline-form wrap"
      onSubmit={(e) => {
        e.preventDefault();
        grant.mutate(undefined, { onSuccess: () => setDays('') });
      }}
    >
      <Field label="الكورس">
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
          <option value="">اختر كورساً…</option>
          {courses.data?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </Field>
      <Field label="المدة بالأيام" hint="اتركها فارغة لاشتراك دائم">
        <input type="number" min={1} max={3650} value={days} onChange={(e) => setDays(e.target.value)} />
      </Field>
      <button type="submit" className="btn btn-primary" disabled={grant.isPending || !courseId}>
        منح الاشتراك
      </button>
      <ErrorBox error={grant.error} />
    </form>
  );
}

export default function StudentDetailPage() {
  const { id } = useParams();
  const detail = useQuery({ queryKey: keys.user(id), queryFn: () => api(`/admin/users/${id}`) });

  if (detail.isPending) return <Spinner />;
  if (detail.error) return <ErrorBox error={detail.error} onRetry={() => detail.refetch()} />;
  const { user, enrollments } = detail.data;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/admin/students" className="back-link">
            → الطلاب
          </Link>
          <h1>{user.name}</h1>
        </div>
      </div>

      <div className="two-col">
        <AccountCard key={`${user.id}-${user.maxDevices}`} user={user} />
        <DevicesCard user={user} />
      </div>

      <section className="card">
        <h2 className="card-title">الاشتراكات</h2>
        {user.status !== USER_STATUS.DELETED && <GrantForm userId={user.id} />}
        {!enrollments.length ? (
          <EmptyState>لا توجد اشتراكات.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الكورس</th>
                  <th>الحالة</th>
                  <th>المصدر</th>
                  <th>البداية</th>
                  <th>الانتهاء</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e) => {
                  const st = enrollmentState(e);
                  return (
                    <tr key={e.id}>
                      <td>{e.course?.title ?? '(كورس محذوف)'}</td>
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
      </section>
    </div>
  );
}
