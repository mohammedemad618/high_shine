import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, downloadFile } from '../../api/client.js';
import { keys, useMyCourses } from '../../api/hooks.js';
import { EmptyState, ErrorBox, Field, ProgressBar, Spinner } from '../../components/ui.jsx';
import { fmtDate, fmtNumber, fromDateInput } from '../../lib/format.js';

const safeName = (s) => s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'codes';

function GenerateForm({ courses }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    courseId: '',
    count: 50,
    batchLabel: '',
    permanent: true,
    durationDays: 30,
    maxUses: 1,
    expiresAt: '',
  });
  const [done, setDone] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const generate = useMutation({
    mutationFn: async () => {
      const body = {
        courseId: form.courseId,
        count: Number(form.count),
        batchLabel: form.batchLabel.trim(),
        durationDays: form.permanent ? null : Number(form.durationDays),
        maxUses: Number(form.maxUses) || 1,
        expiresAt: form.expiresAt ? fromDateInput(form.expiresAt) : null,
      };
      // The API returns the CSV directly; it needs the Authorization header, hence fetch + Blob.
      await downloadFile('/admin/codes', { method: 'POST', query: { format: 'csv' }, body, filename: `codes-${safeName(body.batchLabel)}.csv` });
      return body;
    },
    onSuccess: (body) => {
      setDone(`تم إنشاء ${fmtNumber(body.count)} كود وتنزيلها.`);
      qc.invalidateQueries({ queryKey: ['admin', 'codes'] });
      qc.invalidateQueries({ queryKey: keys.adminStats });
    },
  });

  return (
    <section className="card">
      <h2 className="card-title">إنشاء دفعة أكواد</h2>
      <form
        className="form form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          setDone(null);
          generate.mutate();
        }}
      >
        <Field label="الكورس">
          <select value={form.courseId} onChange={set('courseId')} required>
            <option value="">اختر كورساً…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="اسم الدفعة" hint="مثال: مكتبة الرشيد - تشرين الأول">
          <input value={form.batchLabel} onChange={set('batchLabel')} maxLength={80} required />
        </Field>
        <Field label="عدد الأكواد">
          <input type="number" min={1} max={5000} value={form.count} onChange={set('count')} required />
        </Field>
        <Field label="عدد مرات استخدام الكود">
          <input type="number" min={1} max={10000} value={form.maxUses} onChange={set('maxUses')} required />
        </Field>
        <div className="field">
          <span className="field-label">مدة الاشتراك</span>
          <label className="check">
            <input type="checkbox" checked={form.permanent} onChange={set('permanent')} />
            دائم
          </label>
          {!form.permanent && (
            <input type="number" min={1} max={3650} value={form.durationDays} onChange={set('durationDays')} aria-label="المدة بالأيام" required />
          )}
          {!form.permanent && <span className="field-hint">بالأيام من تاريخ التفعيل</span>}
        </div>
        <Field label="آخر موعد لاستخدام الكود (اختياري)">
          <input type="date" value={form.expiresAt} onChange={set('expiresAt')} />
        </Field>
        <div className="form-actions span-all">
          <button type="submit" className="btn btn-primary" disabled={generate.isPending}>
            {generate.isPending ? 'جارٍ الإنشاء…' : 'إنشاء وتنزيل CSV'}
          </button>
          {done && <span className="text-success">{done}</span>}
        </div>
        <div className="span-all">
          <ErrorBox error={generate.error} />
        </div>
      </form>
    </section>
  );
}

function ExportButton({ batch }) {
  const exp = useMutation({
    mutationFn: () =>
      downloadFile('/admin/codes', {
        query: { courseId: batch.courseId, batchLabel: batch.batchLabel, format: 'csv' },
        filename: `codes-${safeName(batch.batchLabel)}.csv`,
      }),
  });
  return (
    <>
      <button type="button" className="btn btn-sm" disabled={exp.isPending} onClick={() => exp.mutate()}>
        {exp.isPending ? '…' : 'تصدير CSV'}
      </button>
      {exp.error && <span className="text-error small"> {exp.error.message}</span>}
    </>
  );
}

export default function CodesPage() {
  const courses = useMyCourses();
  const [courseId, setCourseId] = useState('');
  const batches = useQuery({
    queryKey: keys.codeBatches(courseId),
    queryFn: () => api('/admin/codes', { query: { courseId: courseId || undefined } }),
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>أكواد التفعيل</h1>
      </div>

      <GenerateForm courses={courses.data?.items ?? []} />

      <section className="card">
        <div className="row-between">
          <h2 className="card-title">الدفعات</h2>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="تصفية حسب الكورس">
            <option value="">كل الكورسات</option>
            {courses.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        {batches.isPending && <Spinner />}
        <ErrorBox error={batches.error} onRetry={() => batches.refetch()} />
        {batches.data && !batches.data.items.length && <EmptyState>لا توجد دفعات.</EmptyState>}
        {batches.data?.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الدفعة</th>
                  <th>الكورس</th>
                  <th>المستخدم</th>
                  <th>المدة</th>
                  <th>التاريخ</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {batches.data.items.map((b) => (
                  <tr key={`${b.courseId}-${b.batchLabel}`}>
                    <td>{b.batchLabel}</td>
                    <td>{b.courseTitle}</td>
                    <td className="used-cell">
                      <span>
                        {fmtNumber(b.used)} / {fmtNumber(b.total)}
                      </span>
                      <ProgressBar value={b.total ? (b.used / b.total) * 100 : 0} />
                    </td>
                    <td>{b.durationDays ? `${fmtNumber(b.durationDays)} يوم` : 'دائم'}</td>
                    <td>{fmtDate(b.createdAt)}</td>
                    <td>
                      <ExportButton batch={b} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
