import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLES } from '@lp/shared';
import { api } from '../api/client.js';
import { keys, useMyCourses, useSession } from '../api/hooks.js';
import { CourseStatusBadge, EmptyState, ErrorBox, Field, Modal, Spinner } from '../components/ui.jsx';
import { fmtDuration, fmtNumber, fmtPrice } from '../lib/format.js';

function CreateCourseModal({ onClose }) {
  const { isAdmin } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', priceIqd: 0, teacherId: '' });
  const teachers = useQuery({
    queryKey: keys.users({ role: ROLES.TEACHER, limit: 100 }),
    queryFn: () => api('/admin/users', { query: { role: ROLES.TEACHER, limit: 100 } }),
    enabled: isAdmin,
  });

  const create = useMutation({
    mutationFn: () =>
      api('/courses', {
        method: 'POST',
        body: {
          title: form.title.trim(),
          description: form.description,
          priceIqd: Number(form.priceIqd) || 0,
          ...(isAdmin && form.teacherId ? { teacherId: form.teacherId } : {}),
        },
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: keys.myCourses });
      navigate(`/courses/${data.course.id}`);
    },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title="كورس جديد" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <ErrorBox error={create.error} />
        <Field label="عنوان الكورس">
          <input value={form.title} onChange={set('title')} minLength={3} maxLength={150} required />
        </Field>
        <Field label="الوصف">
          <textarea rows={4} value={form.description} onChange={set('description')} maxLength={5000} />
        </Field>
        <Field label="السعر (دينار عراقي)">
          <input type="number" min={0} step={250} value={form.priceIqd} onChange={set('priceIqd')} />
        </Field>
        {isAdmin && (
          <Field label="المدرّس" hint="اتركه فارغاً ليكون الكورس باسمك">
            <select value={form.teacherId} onChange={set('teacherId')}>
              <option value="">—</option>
              {teachers.data?.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.phone})
                </option>
              ))}
            </select>
          </Field>
        )}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>
            {create.isPending ? 'جارٍ الإنشاء…' : 'إنشاء'}
          </button>
          <button type="button" className="btn" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function CoursesPage() {
  const { isAdmin } = useSession();
  const courses = useMyCourses();
  const [creating, setCreating] = useState(false);

  return (
    <div className="page">
      <div className="page-header">
        <h1>{isAdmin ? 'كل الكورسات' : 'كورساتي'}</h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          + كورس جديد
        </button>
      </div>

      {courses.isPending && <Spinner />}
      <ErrorBox error={courses.error} onRetry={() => courses.refetch()} />

      {courses.data && !courses.data.items.length && <EmptyState>لا توجد كورسات بعد. أنشئ أول كورس للبدء.</EmptyState>}

      <div className="course-grid">
        {courses.data?.items.map((c) => (
          <article key={c.id} className="card course-card">
            <div className="course-cover">{c.coverUrl ? <img src={c.coverUrl} alt="" loading="lazy" /> : <span>بلا غلاف</span>}</div>
            <div className="course-card-body">
              <div className="row-between">
                <h2 className="course-title">{c.title}</h2>
                <CourseStatusBadge status={c.status} />
              </div>
              {isAdmin && c.teacher?.name && <div className="muted">المدرّس: {c.teacher.name}</div>}
              <div className="muted">
                {fmtNumber(c.stats.lessonsCount)} درس جاهز · {fmtDuration(c.stats.totalDurationSec)} · {fmtPrice(c.priceIqd)}
              </div>
              <div className="card-actions">
                <Link to={`/courses/${c.id}`} className="btn btn-sm btn-primary">
                  تحرير
                </Link>
                <Link to={`/courses/${c.id}/stats`} className="btn btn-sm">
                  الإحصائيات
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {creating && <CreateCourseModal onClose={() => setCreating(false)} />}
    </div>
  );
}
