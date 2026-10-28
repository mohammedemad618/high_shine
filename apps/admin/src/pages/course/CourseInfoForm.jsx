import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { ErrorBox, Field } from '../../components/ui.jsx';
import { setCourseDetails, setCourseSummary } from './courseCache.js';

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Title, description, price and cover of a course. */
export default function CourseInfoForm({ course }) {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [form, setForm] = useState({ title: course.title, description: course.description || '', priceIqd: course.priceIqd ?? 0 });
  const [saved, setSaved] = useState(false);
  const [coverError, setCoverError] = useState(null);

  const dirty =
    form.title !== course.title || form.description !== (course.description || '') || Number(form.priceIqd) !== (course.priceIqd ?? 0);

  const save = useMutation({
    mutationFn: () =>
      api(`/courses/${course.id}`, {
        method: 'PATCH',
        body: { title: form.title.trim(), description: form.description, priceIqd: Number(form.priceIqd) || 0 },
      }),
    onSuccess: (data) => {
      setCourseDetails(qc, course.id, data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const cover = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return api(`/courses/${course.id}/cover`, { method: 'POST', form: fd });
    },
    onSuccess: (data) => setCourseSummary(qc, course.id, data.course),
  });

  function onCoverPicked(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setCoverError(null);
    if (!file) return;
    if (!COVER_TYPES.includes(file.type)) return setCoverError({ message: 'الصورة يجب أن تكون JPEG أو PNG أو WebP' });
    if (file.size > MAX_COVER_BYTES) return setCoverError({ message: 'حجم الصورة يجب ألا يتجاوز 5 ميغابايت' });
    cover.mutate(file);
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section className="card course-info">
      <div className="cover-box">
        <div className="course-cover large">{course.coverUrl ? <img src={course.coverUrl} alt="غلاف الكورس" /> : <span>بلا غلاف</span>}</div>
        <input ref={fileRef} type="file" accept={COVER_TYPES.join(',')} hidden onChange={onCoverPicked} />
        <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={cover.isPending}>
          {cover.isPending ? 'جارٍ الرفع…' : course.coverUrl ? 'تغيير الغلاف' : 'رفع غلاف'}
        </button>
        <ErrorBox error={coverError || cover.error} />
      </div>

      <form
        className="form grow"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <ErrorBox error={save.error} />
        <Field label="عنوان الكورس">
          <input value={form.title} onChange={set('title')} minLength={3} maxLength={150} required />
        </Field>
        <Field label="الوصف">
          <textarea rows={4} value={form.description} onChange={set('description')} maxLength={5000} />
        </Field>
        <Field label="السعر (دينار عراقي)">
          <input type="number" min={0} step={250} value={form.priceIqd} onChange={set('priceIqd')} />
        </Field>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={!dirty || save.isPending}>
            {save.isPending ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
          </button>
          {saved && <span className="text-success">تم الحفظ</span>}
        </div>
      </form>
    </section>
  );
}
