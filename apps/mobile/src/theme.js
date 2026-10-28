// Design tokens from the "تصميم منصة المحاضرات" canvas: deep teal primary, amber highlights, calm greys.
export const colors = {
  bg: '#F5F6F8',
  card: '#FFFFFF',
  border: '#E4E7EC',
  borderStrong: '#D0D5DD',
  divider: '#F2F4F7',
  track: '#EAECF0',

  text: '#101828',
  textSecondary: '#344054',
  muted: '#475467',
  subtle: '#98A2B3',

  primary: '#0B6B5C',
  primaryDark: '#08584B',
  primaryTint: '#E7F3F0',
  primaryRowTint: '#F6FBF9',
  onPrimaryMuted: '#D3EAE4',
  primaryText: '#FFFFFF',

  amber: '#F5B83D',
  amberTint: '#FEF5E1',
  amberText: '#8A5A00',
  amberInk: '#3D2A00',

  danger: '#B42318',
  dangerTint: '#FEF3F2',
  dangerBorder: '#FECDCA',

  info: '#1F5FBF',
  infoTint: '#EAF1FD',

  player: '#0B1220',
  playerSurface: '#111C2E',
  playerMuted: '#A9B4C7',
  black: '#000000',
  white: '#FFFFFF',
};

// IBM Plex Sans Arabic, loaded in the root layout. Android ignores fontWeight for custom fonts,
// so every weight is its own family.
export const fonts = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const radius = { sm: 8, md: 12, lg: 14, xl: 18, pill: 999 };

// Course covers without an uploaded image get a colour picked from the course id, so each course keeps its own.
export const coverPalette = ['#0B6B5C', '#23306B', '#5B2A6E', '#8A4B10', '#1F4E79'];

export function coverColor(id = '') {
  // Mongo ids end in an incrementing counter, so courses created one after another get different colours.
  const tail = parseInt(id.slice(-6), 16);
  if (Number.isFinite(tail)) return coverPalette[tail % coverPalette.length];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return coverPalette[hash % coverPalette.length];
}

export function formatDuration(totalSec) {
  if (!totalSec && totalSec !== 0) return '';
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

// Arabic count + noun: singular, dual, plural for 3–10, singular accusative-style for 11+.
function counted(n, [one, two, few, many]) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return `${n} ${few}`;
  return `${n} ${many}`;
}

// "18 ساعة" / "3 دقائق" for course totals.
export function formatHours(totalSec) {
  if (!totalSec) return '';
  const hours = Math.round(totalSec / 3600);
  if (hours >= 1) return counted(hours, ['ساعة واحدة', 'ساعتان', 'ساعات', 'ساعة']);
  return counted(Math.max(1, Math.round(totalSec / 60)), ['دقيقة واحدة', 'دقيقتان', 'دقائق', 'دقيقة']);
}

export function formatLessons(n) {
  return counted(n, ['درس واحد', 'درسان', 'دروس', 'درساً']);
}

export function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميغابايت`;
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join(' ');
}

export function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}
