import { useEffect } from 'react';
import { COURSE_STATUS, LESSON_STATUS } from '@lp/shared';

export function Spinner({ label = 'جارٍ التحميل…' }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="alert alert-error" role="alert">
      <span>{error.message || 'حدث خطأ غير متوقع'}</span>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}

export function Notice({ kind = 'info', children }) {
  return <div className={`alert alert-${kind}`}>{children}</div>;
}

export function ProgressBar({ value, tone = 'primary' }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={`progress progress-${tone}`} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-fill" style={{ width: `${v}%` }} />
    </div>
  );
}

const LESSON_LABELS = {
  [LESSON_STATUS.DRAFT]: 'بلا فيديو',
  [LESSON_STATUS.UPLOADING]: 'قيد الرفع',
  [LESSON_STATUS.QUEUED]: 'في الانتظار',
  [LESSON_STATUS.PROCESSING]: 'قيد المعالجة',
  [LESSON_STATUS.READY]: 'جاهز',
  [LESSON_STATUS.FAILED]: 'فشلت المعالجة',
};

export function LessonStatusBadge({ status, progress }) {
  const label = LESSON_LABELS[status] || status;
  const showPct = status === LESSON_STATUS.PROCESSING && typeof progress === 'number';
  return (
    <span className={`badge badge-${status}`}>
      {label}
      {showPct ? ` ${Math.round(progress)}%` : ''}
    </span>
  );
}

const COURSE_LABELS = {
  [COURSE_STATUS.DRAFT]: 'مسودة',
  [COURSE_STATUS.PUBLISHED]: 'منشور',
  [COURSE_STATUS.HIDDEN]: 'مخفي',
};

export function CourseStatusBadge({ status }) {
  return <span className={`badge badge-course-${status}`}>{COURSE_LABELS[status] || status}</span>;
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="إغلاق">
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Pagination({ page, limit, total, onChange }) {
  const pages = Math.max(1, Math.ceil((total || 0) / limit));
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="الصفحات">
      <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        السابق
      </button>
      <span>
        صفحة {page} من {pages}
      </span>
      <button type="button" className="btn btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        التالي
      </button>
    </nav>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function StatTile({ label, value, sub }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {sub && <div className="tile-sub">{sub}</div>}
    </div>
  );
}

export function EmptyState({ children }) {
  return <div className="empty">{children}</div>;
}
