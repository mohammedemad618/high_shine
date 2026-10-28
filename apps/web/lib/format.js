// Arabic labels with Latin digits (common for prices and phone numbers in Iraq).
const LOCALE = 'ar-IQ-u-nu-latn';

/** 75 → "1:15", 3725 → "1:02:05" */
export function formatClock(totalSec) {
  const s = Math.max(0, Math.floor(totalSec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** 12600 → "3 س 30 د" */
export function formatTotalDuration(totalSec) {
  const s = Math.max(0, Math.round(totalSec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (!h && !m) return '';
  if (!h) return `${m} دقيقة`;
  return m ? `${h} س ${m} د` : `${h} ساعة`;
}

export function formatPrice(iqd) {
  if (!iqd) return '';
  return `${new Intl.NumberFormat(LOCALE).format(iqd)} د.ع`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(LOCALE, { year: 'numeric', month: 'long', day: 'numeric' }).format(d);
}

export function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Plain-text excerpt for meta descriptions. */
export function excerpt(text, max = 160) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
