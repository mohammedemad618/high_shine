import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLES } from '@lp/shared';
import { api } from '../../api/client.js';
import { keys } from '../../api/hooks.js';
import { EmptyState, ErrorBox, Field, Modal, Pagination, Spinner, USER_STATUS_LABELS } from '../../components/ui.jsx';
import { fmtDate } from '../../lib/format.js';

function CreateTeacherModal({ onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', phone: '', password: '' });
  const create = useMutation({
    mutationFn: () => api('/admin/teachers', { method: 'POST', body: { ...form, name: form.name.trim(), phone: form.phone.trim() } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      qc.invalidateQueries({ queryKey: keys.adminStats });
      onClose();
    },
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title="إضافة مدرّس" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <ErrorBox error={create.error} />
        <Field label="الاسم">
          <input value={form.name} onChange={set('name')} minLength={2} maxLength={80} required />
        </Field>
        <Field label="رقم الهاتف">
          <input type="tel" dir="ltr" value={form.phone} onChange={set('phone')} required />
        </Field>
        <Field label="كلمة المرور" hint="8 أحرف على الأقل. سلّمها للمدرّس بطريقة آمنة.">
          <input type="text" dir="ltr" autoComplete="new-password" value={form.password} onChange={set('password')} minLength={8} required />
        </Field>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>
            {create.isPending ? 'جارٍ الحفظ…' : 'إضافة'}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function TeachersPage() {
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const params = { role: ROLES.TEACHER, page, limit: 20 };
  const list = useQuery({ queryKey: keys.users(params), queryFn: () => api('/admin/users', { query: params }), placeholderData: (p) => p });

  return (
    <div className="page">
      <div className="page-header">
        <h1>المدرّسون</h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          + إضافة مدرّس
        </button>
      </div>
      {list.isPending && <Spinner />}
      <ErrorBox error={list.error} onRetry={() => list.refetch()} />
      {list.data && !list.data.items.length && <EmptyState>لا يوجد مدرّسون بعد.</EmptyState>}
      {list.data?.items.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th>الحالة</th>
                <th>الأجهزة</th>
                <th>تاريخ الإضافة</th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td dir="ltr" className="ltr-cell">{t.phone}</td>
                  <td>{USER_STATUS_LABELS[t.status] || t.status}</td>
                  <td>
                    {t.devices.length}/{t.maxDevices}
                  </td>
                  <td>{fmtDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data && <Pagination page={page} limit={list.data.limit} total={list.data.total} onChange={setPage} />}
      {creating && <CreateTeacherModal onClose={() => setCreating(false)} />}
    </div>
  );
}
