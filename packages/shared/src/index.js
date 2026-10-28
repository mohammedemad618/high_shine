// Constants shared by the API, the worker and the three front ends.
// Keep this file free of Node-only imports: it is bundled for the browser and React Native too.

export const ROLES = Object.freeze({
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin',
});

export const USER_STATUS = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  // Set only by the student's own account deletion; the record stays (anonymized) for enrollment accounting.
  DELETED: 'deleted',
});

export const COURSE_STATUS = Object.freeze({
  DRAFT: 'draft',
  PUBLISHED: 'published',
  HIDDEN: 'hidden',
});

// draft → uploading → queued → processing → ready, or failed (reprocess sends it back to queued).
export const LESSON_STATUS = Object.freeze({
  DRAFT: 'draft',
  UPLOADING: 'uploading',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
});

export const ENROLLMENT_STATUS = Object.freeze({
  ACTIVE: 'active',
  REVOKED: 'revoked',
});

export const ENROLLMENT_SOURCE = Object.freeze({
  CODE: 'code',
  ADMIN: 'admin',
});

export const ERROR_CODES = Object.freeze({
  VALIDATION: 'VALIDATION',
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',

  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  PHONE_TAKEN: 'PHONE_TAKEN',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  DEVICE_LIMIT: 'DEVICE_LIMIT',
  DEVICE_REPLACE_LOCKED: 'DEVICE_REPLACE_LOCKED',
  DEVICE_REVOKED: 'DEVICE_REVOKED',
  REFRESH_INVALID: 'REFRESH_INVALID',
  WRONG_PASSWORD: 'WRONG_PASSWORD',

  NOT_ENROLLED: 'NOT_ENROLLED',
  LESSON_NOT_READY: 'LESSON_NOT_READY',
  CONCURRENT_PLAYBACK: 'CONCURRENT_PLAYBACK',
  PLAYBACK_TOKEN_INVALID: 'PLAYBACK_TOKEN_INVALID',

  CODE_INVALID: 'CODE_INVALID',
  CODE_EXPIRED: 'CODE_EXPIRED',
  CODE_USED_UP: 'CODE_USED_UP',
  CODE_ALREADY_REDEEMED: 'CODE_ALREADY_REDEEMED',
  ALREADY_ENROLLED: 'ALREADY_ENROLLED',
  COURSE_NOT_PUBLISHED: 'COURSE_NOT_PUBLISHED',

  INVALID_STATE: 'INVALID_STATE',
});

// Arabic messages for the front ends, keyed by error code.
export const ERROR_MESSAGES_AR = Object.freeze({
  VALIDATION: 'البيانات المُدخلة غير صحيحة',
  UNAUTHORIZED: 'يجب تسجيل الدخول',
  TOKEN_EXPIRED: 'انتهت الجلسة، أعد تسجيل الدخول',
  FORBIDDEN: 'ليست لديك صلاحية لهذا الإجراء',
  NOT_FOUND: 'العنصر غير موجود',
  CONFLICT: 'تعارض في البيانات',
  RATE_LIMITED: 'محاولات كثيرة، حاول بعد قليل',
  INTERNAL: 'حدث خطأ غير متوقع',
  INVALID_CREDENTIALS: 'رقم الهاتف أو كلمة المرور غير صحيحة',
  PHONE_TAKEN: 'رقم الهاتف مسجّل مسبقاً',
  ACCOUNT_SUSPENDED: 'الحساب موقوف، تواصل مع الإدارة',
  DEVICE_LIMIT: 'وصلت إلى الحد الأقصى للأجهزة المسموح بها لحسابك',
  DEVICE_REPLACE_LOCKED: 'استبدلت جهازاً مؤخراً. يمكنك الاستبدال مرة أخرى لاحقاً أو التواصل مع الدعم',
  DEVICE_REVOKED: 'أُزيل هذا الجهاز من حسابك، سجّل الدخول من جديد',
  REFRESH_INVALID: 'انتهت الجلسة، أعد تسجيل الدخول',
  WRONG_PASSWORD: 'كلمة المرور الحالية غير صحيحة',
  NOT_ENROLLED: 'يجب تفعيل الكورس لمشاهدة هذا الدرس',
  LESSON_NOT_READY: 'الدرس قيد المعالجة',
  CONCURRENT_PLAYBACK: 'الحساب يشاهد من جهاز آخر الآن',
  PLAYBACK_TOKEN_INVALID: 'انتهت صلاحية رابط التشغيل، أعد فتح الدرس',
  CODE_INVALID: 'الكود غير صحيح',
  CODE_EXPIRED: 'انتهت صلاحية الكود',
  CODE_USED_UP: 'استُخدم الكود بالكامل',
  CODE_ALREADY_REDEEMED: 'استخدمت هذا الكود من قبل',
  ALREADY_ENROLLED: 'أنت مشترك في هذا الكورس اشتراكاً دائماً',
  COURSE_NOT_PUBLISHED: 'الكورس غير متاح حالياً',
  INVALID_STATE: 'لا يمكن تنفيذ هذا الإجراء في الحالة الحالية',
});

export const DEFAULT_MAX_DEVICES = 2;
export const PROGRESS_PING_SECONDS = 15;
export const UPLOAD_CHUNK_BYTES = 50 * 1024 * 1024;
// A lesson counts as completed once the student has reached this share of its duration.
export const COMPLETION_RATIO = 0.9;

// Transcode ladder (see the plan's encoding table). Never upscale: renditions taller than the source are skipped.
export const RENDITIONS = Object.freeze([
  { name: '360p', width: 640, height: 360, videoKbps: 400, audioKbps: 64 },
  { name: '480p', width: 854, height: 480, videoKbps: 700, audioKbps: 96 },
  { name: '720p', width: 1280, height: 720, videoKbps: 1200, audioKbps: 96 },
]);

export const HLS_SEGMENT_SECONDS = 6;
export const KEYFRAME_SECONDS = 2;
export const KEY_URI_PLACEHOLDER = 'KEY_URI';

export function errorMessage(code) {
  return ERROR_MESSAGES_AR[code] || ERROR_MESSAGES_AR.INTERNAL;
}

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits → 0-9, so a number typed on an Arabic keyboard is accepted. */
export function toLatinDigits(value) {
  return String(value ?? '').replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf));
}

/**
 * One stored form per phone: Iraqi mobiles become 07XXXXXXXXX whether typed as 07…, 7…, 9647…, +9647… or 009647…,
 * so the same student can never end up with two accounts. Other numbers keep their digits (with + if given).
 */
export function normalizePhone(value) {
  const raw = toLatinDigits(value).replace(/[\s\-().]/g, '');
  const digits = raw.replace(/^\+/, '').replace(/^00/, '');
  const iraqi = digits.match(/^(?:964|0)?(7\d{9})$/);
  if (iraqi) return `0${iraqi[1]}`;
  return raw.startsWith('+') || raw.startsWith('00') ? `+${digits}` : digits;
}
