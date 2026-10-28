// Public values are inlined at build time (NEXT_PUBLIC_*). Server-only values are read at runtime.

export const PUBLIC_API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/+$/, '');

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

export const SITE_NAME = 'منصة المحاضرات';
export const SITE_DESCRIPTION = 'شاهد محاضرات أفضل المدرسين أونلاين، في أي وقت ومن أي مكان.';

/** Base URL for server-side fetches: inside Docker the web container reaches the api container directly. */
export function serverApiUrl() {
  return (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(
    /\/+$/,
    '',
  );
}
