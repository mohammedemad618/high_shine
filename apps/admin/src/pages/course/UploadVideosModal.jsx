import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { keys } from '../../api/hooks.js';
import { ErrorBox, Field, Modal } from '../../components/ui.jsx';
import { fmtBytes, stripExtension } from '../../lib/format.js';
import { uploadLessonVideo } from '../../upload/uploader.js';

/**
 * Pick several videos, choose the section; each file becomes a lesson (title = file name)
 * and is uploaded in the background (progress in the upload panel).
 */
export default function UploadVideosModal({ courseId, sections, onClose }) {
  const qc = useQueryClient();
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? '');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState(null);

  function onPick(e) {
    const picked = [...(e.target.files || [])];
    e.target.value = '';
    // Natural sort so "درس 2" comes before "درس 10".
    picked.sort((a, b) => a.name.localeCompare(b.name, 'ar', { numeric: true }));
    setFiles((prev) => [...prev, ...picked.map((file) => ({ file, title: stripExtension(file.name) }))]);
  }

  async function start() {
    setBusy(true);
    setError(null);
    let created = 0;
    try {
      for (const { file, title } of files) {
        const { lesson } = await api(`/courses/${courseId}/lessons`, {
          method: 'POST',
          body: { title: title.trim().slice(0, 150) || stripExtension(file.name), sectionId },
        });
        uploadLessonVideo({ file, lessonId: lesson.id, courseId, title: lesson.title });
        created++;
        setDone(created);
      }
      qc.invalidateQueries({ queryKey: keys.course(courseId) });
      onClose();
    } catch (err) {
      // Lessons created so far keep uploading; drop them from the list so a retry doesn't duplicate them.
      setFiles((prev) => prev.slice(created));
      setDone(0);
      setError(err);
      qc.invalidateQueries({ queryKey: keys.course(courseId) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="رفع فيديوهات" onClose={busy ? () => {} : onClose} wide>
      <div className="form">
        <ErrorBox error={error} />
        <Field label="القسم">
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={busy}>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </Field>

        <label className="file-drop">
          <input type="file" accept="video/*,.mkv,.mov,.mp4,.avi,.webm" multiple onChange={onPick} disabled={busy} />
          <span>اختر ملفات الفيديو (يمكن اختيار عدة ملفات)</span>
        </label>

        {files.length > 0 && (
          <ul className="file-list">
            {files.map((f, i) => (
              <li key={`${f.file.name}-${f.file.size}-${i}`}>
                <input
                  value={f.title}
                  onChange={(e) => setFiles((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                  disabled={busy}
                  aria-label="عنوان الدرس"
                />
                <span className="muted small">{fmtBytes(f.file.size)}</span>
                <button
                  type="button"
                  className="btn-icon"
                  disabled={busy}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="إزالة"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="muted small">
          يُنشأ درس لكل ملف ثم يبدأ الرفع في الخلفية. يمكنك متابعة العمل أثناء الرفع، ويُستأنف الرفع تلقائياً إذا انقطع الاتصال.
        </p>

        <div className="form-actions">
          <button type="button" className="btn btn-primary" disabled={busy || !files.length || !sectionId} onClick={start}>
            {busy ? `جارٍ إنشاء الدروس ${done}/${files.length}…` : `رفع ${files.length || ''} فيديو`}
          </button>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
