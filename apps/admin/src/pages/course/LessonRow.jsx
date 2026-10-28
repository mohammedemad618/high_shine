import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LESSON_STATUS } from '@lp/shared';
import { api } from '../../api/client.js';
import { keys, useLessonStatus } from '../../api/hooks.js';
import { ErrorBox, LessonStatusBadge, ProgressBar } from '../../components/ui.jsx';
import { fmtBytes, fmtDuration } from '../../lib/format.js';
import { isActive, retryUpload, uploadLessonVideo, useLessonUpload } from '../../upload/uploader.js';
import { setLesson } from './courseCache.js';

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const POLLED = [LESSON_STATUS.QUEUED, LESSON_STATUS.PROCESSING];

function Attachments({ lesson, courseId }) {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [localError, setLocalError] = useState(null);

  const add = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return api(`/lessons/${lesson.id}/attachments`, { method: 'POST', form: fd });
    },
    onSuccess: (data) => setLesson(qc, courseId, data.lesson),
  });
  const remove = useMutation({
    mutationFn: (attachmentId) => api(`/lessons/${lesson.id}/attachments/${attachmentId}`, { method: 'DELETE' }),
    onSuccess: (data) => setLesson(qc, courseId, data.lesson),
  });

  function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setLocalError(null);
    if (!file) return;
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return setLocalError({ message: 'يُسمح بملفات PDF فقط' });
    if (file.size > MAX_PDF_BYTES) return setLocalError({ message: 'حجم الملف يجب ألا يتجاوز 50 ميغابايت' });
    add.mutate(file);
  }

  return (
    <div className="attachments">
      <ErrorBox error={localError || add.error || remove.error} />
      {lesson.attachments?.length ? (
        <ul>
          {lesson.attachments.map((a) => (
            <li key={a.id}>
              <span>📄 {a.name}</span>
              <span className="muted small">{fmtBytes(a.size)}</span>
              <button
                type="button"
                className="btn btn-sm btn-ghost danger"
                disabled={remove.isPending}
                onClick={() => window.confirm(`حذف الملف «${a.name}»؟`) && remove.mutate(a.id)}
              >
                حذف
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="muted small">لا توجد ملفات مرفقة.</div>
      )}
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden onChange={onPick} />
      <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={add.isPending}>
        {add.isPending ? 'جارٍ رفع الملف…' : '+ إضافة PDF'}
      </button>
    </div>
  );
}

/** One lesson inside the editor. `handle` is the drag handle element supplied by the sortable wrapper. */
export default function LessonRow({ lesson, courseId, handle }) {
  const qc = useQueryClient();
  const videoRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [showFiles, setShowFiles] = useState(false);

  const local = useLessonUpload(lesson.id);
  // In flight = queued, uploading, waiting for network, or failed (retryable) in this browser session.
  const localInFlight = Boolean(local && local.state !== 'done');
  const localActive = Boolean(local && isActive(local));
  const polling = POLLED.includes(lesson.status);
  const live = useLessonStatus(lesson.id, courseId, polling);
  const status = polling && live ? live.status : lesson.status;
  const processing = (polling && live ? live.processing : lesson.processing) || {};

  const update = useMutation({
    mutationFn: (body) => api(`/lessons/${lesson.id}`, { method: 'PATCH', body }),
    onSuccess: (data) => {
      setLesson(qc, courseId, data.lesson);
      setEditing(false);
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/lessons/${lesson.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.course(courseId) });
      qc.invalidateQueries({ queryKey: keys.myCourses });
    },
  });
  const reprocess = useMutation({
    mutationFn: () => api(`/lessons/${lesson.id}/reprocess`, { method: 'POST' }),
    onSuccess: (data) => setLesson(qc, courseId, data.lesson),
  });

  function onVideoPicked(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) uploadLessonVideo({ file, lessonId: lesson.id, courseId, title: lesson.title });
  }

  function pickVideo() {
    if (status === LESSON_STATUS.READY && !window.confirm('استبدال فيديو هذا الدرس؟ ستُعاد معالجته من جديد.')) return;
    videoRef.current?.click();
  }

  const canUpload = !localInFlight && !POLLED.includes(status);
  const uploadLabel =
    status === LESSON_STATUS.UPLOADING
      ? 'استئناف الرفع'
      : status === LESSON_STATUS.READY
        ? 'استبدال الفيديو'
        : status === LESSON_STATUS.FAILED
          ? 'رفع فيديو آخر'
          : 'رفع فيديو';

  return (
    <div className="lesson">
      <div className="lesson-main">
        {handle}
        <div className="lesson-info">
          {editing ? (
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (title.trim()) update.mutate({ title: title.trim() });
              }}
            >
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} autoFocus />
              <button type="submit" className="btn btn-sm btn-primary" disabled={update.isPending}>
                حفظ
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setTitle(lesson.title);
                  setEditing(false);
                }}
              >
                إلغاء
              </button>
            </form>
          ) : (
            <div className="lesson-title-row">
              <span className="lesson-title">{lesson.title}</span>
              <button type="button" className="btn-link" onClick={() => setEditing(true)}>
                تعديل الاسم
              </button>
            </div>
          )}

          <div className="lesson-meta">
            {localInFlight ? (
              <span className={`badge ${local.state === 'error' ? 'badge-failed' : 'badge-uploading'}`}>
                {local.state === 'offline' ? 'بانتظار الشبكة' : local.state === 'error' ? 'تعثّر الرفع' : 'قيد الرفع'} {local.percent}%
              </span>
            ) : (
              <LessonStatusBadge status={status} progress={processing.progress} />
            )}
            {lesson.durationSec ? <span className="muted small">{fmtDuration(lesson.durationSec)}</span> : null}
            {lesson.video?.originalName && <span className="muted small" title={lesson.video.originalName}>{lesson.video.originalName}</span>}
            <label className="check">
              <input
                type="checkbox"
                checked={lesson.isFreePreview}
                disabled={update.isPending}
                onChange={(e) => update.mutate({ isFreePreview: e.target.checked })}
              />
              معاينة مجانية
            </label>
          </div>

          {localInFlight && <ProgressBar value={local.percent} tone={local.state === 'error' ? 'error' : 'primary'} />}
          {local?.state === 'error' && (
            <div className="text-error small">
              {local.error}{' '}
              <button type="button" className="btn-link" onClick={() => retryUpload(local.id)}>
                إعادة المحاولة
              </button>
            </div>
          )}
          {!localInFlight && status === LESSON_STATUS.PROCESSING && <ProgressBar value={processing.progress} tone="processing" />}
          {!localInFlight && status === LESSON_STATUS.UPLOADING && (
            <div className="text-warn small">الرفع غير مكتمل. اختر الملف نفسه عبر «استئناف الرفع» ليُكمل من حيث توقف.</div>
          )}
          {status === LESSON_STATUS.FAILED && processing.error && <div className="text-error small">سبب الفشل: {processing.error}</div>}
          <ErrorBox error={update.error || remove.error || reprocess.error} />
        </div>

        <div className="lesson-actions">
          <input ref={videoRef} type="file" accept="video/*,.mkv,.mov,.mp4,.avi,.webm" hidden onChange={onVideoPicked} />
          {canUpload && (
            <button type="button" className="btn btn-sm" onClick={pickVideo}>
              {uploadLabel}
            </button>
          )}
          {status === LESSON_STATUS.FAILED && lesson.video?.hasSource && (
            <button type="button" className="btn btn-sm btn-primary" disabled={reprocess.isPending} onClick={() => reprocess.mutate()}>
              إعادة المعالجة
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={() => setShowFiles((v) => !v)} aria-expanded={showFiles}>
            المرفقات ({lesson.attachments?.length ?? lesson.attachmentsCount ?? 0})
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost danger"
            disabled={remove.isPending || status === LESSON_STATUS.PROCESSING || localActive}
            title={status === LESSON_STATUS.PROCESSING ? 'انتظر انتهاء المعالجة' : undefined}
            onClick={() => window.confirm(`حذف الدرس «${lesson.title}» نهائياً مع الفيديو والمرفقات؟`) && remove.mutate()}
          >
            حذف
          </button>
        </div>
      </div>

      {showFiles && <Attachments lesson={lesson} courseId={courseId} />}
    </div>
  );
}
