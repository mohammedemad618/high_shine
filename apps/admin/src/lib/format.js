const numberFmt = new Intl.NumberFormat('ar-IQ');
const dateFmt = new Intl.DateTimeFormat('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const fmtNumber = (n) => (n === null || n === undefined ? '—' : numberFmt.format(n));
export const fmtDate = (d) => (d ? dateFmt.format(new Date(d)) : '—');
export const fmtDateTime = (d) => (d ? dateTimeFmt.format(new Date(d)) : '—');
export const fmtPrice = (iqd) => `${fmtNumber(iqd ?? 0)} د.ع`;

export function fmtBytes(bytes) {
  if (!bytes && bytes !== 0) return '—';
  const units = ['بايت', 'ك.ب', 'م.ب', 'غ.ب'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function fmtDuration(sec) {
  if (!sec && sec !== 0) return '—';
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** "lecture 01.final.mp4" → "lecture 01.final" */
export const stripExtension = (name) => name.replace(/\.[^./\\]+$/, '') || name;

/** ISO date string (yyyy-mm-dd) for <input type="date"> */
export const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

/** End of the chosen local day, as ISO. */
export const fromDateInput = (value) => (value ? new Date(`${value}T23:59:59`).toISOString() : null);
