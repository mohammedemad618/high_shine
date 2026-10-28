import { useState } from 'react';
import { Link } from 'react-router';
import { LESSON_STATUS } from '@lp/shared';
import { useLessonStatus } from '../api/hooks.js';
import { cancelUpload, clearFinishedUploads, dismissUpload, isActive, retryUpload, useUploads } from '../upload/uploader.js';
import { fmtBytes } from '../lib/format.js';
import { LessonStatusBadge, ProgressBar } from './ui.jsx';

/** After the upload: poll the lesson until it is ready or failed. */
function ProcessingLine({ item }) {
  const status = useLessonStatus(item.lessonId, item.courseId, true);
  if (!status) return <div className="upload-sub">اكتمل الرفع، جارٍ التحقق من المعالجة…</div>;
  const pct = status.processing?.progress ?? 0;
  return (
    <div className="upload-sub">
      <LessonStatusBadge status={status.status} progress={pct} />
      {status.status === LESSON_STATUS.PROCESSING && <ProgressBar value={pct} tone="processing" />}
      {status.status === LESSON_STATUS.FAILED && status.processing?.error && <div className="text-error">{status.processing.error}</div>}
    </div>
  );
}

function UploadRow({ item }) {
  return (
    <li className="upload-item">
      <div className="upload-head">
        <Link to={`/courses/${item.courseId}`} className="upload-title" title={item.name}>
          {item.title}
        </Link>
        <span className="muted">{fmtBytes(item.size)}</span>
      </div>

      {item.state === 'done' ? (
        <ProcessingLine item={item} />
      ) : (
        <>
          <ProgressBar value={item.percent} tone={item.state === 'error' ? 'error' : 'primary'} />
          <div className="upload-sub">
            {item.state === 'queued' && <span>في قائمة الانتظار…</span>}
            {item.state === 'uploading' && <span>جارٍ الرفع {item.percent}%</span>}
            {item.state === 'offline' && <span className="text-warn">لا يوجد اتصال — سيُستأنف الرفع تلقائياً ({item.percent}%)</span>}
            {item.state === 'error' && <span className="text-error">{item.error}</span>}
          </div>
        </>
      )}

      <div className="upload-actions">
        {item.state === 'error' && (
          <button type="button" className="btn btn-sm" onClick={() => retryUpload(item.id)}>
            إعادة المحاولة
          </button>
        )}
        {item.state !== 'done' ? (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => window.confirm('إلغاء رفع هذا الملف؟') && cancelUpload(item.id)}
          >
            إلغاء
          </button>
        ) : (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => dismissUpload(item.id)}>
            إخفاء
          </button>
        )}
      </div>
    </li>
  );
}

export default function UploadPanel() {
  const uploads = useUploads();
  const [collapsed, setCollapsed] = useState(false);
  if (!uploads.length) return null;
  const active = uploads.filter(isActive).length;

  return (
    <section className="upload-panel" aria-label="عمليات الرفع">
      <header className="upload-panel-header">
        <button type="button" className="upload-panel-toggle" onClick={() => setCollapsed((v) => !v)}>
          {active ? `جارٍ رفع ${active} ملف` : 'عمليات الرفع'} {collapsed ? '▴' : '▾'}
        </button>
        {uploads.some((u) => u.state === 'done') && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={clearFinishedUploads}>
            مسح المكتمل
          </button>
        )}
      </header>
      {!collapsed && (
        <ul className="upload-list">
          {uploads.map((item) => (
            <UploadRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}
