// Server components only (uses INTERNAL_API_URL and Next's fetch cache).
import { serverApiUrl } from './config.js';

const REVALIDATE_SECONDS = 60;
const TIMEOUT_MS = 8000;

/**
 * Public (anonymous) GET against the API from a server component.
 * Returns { data } on success, { notFound: true } on 404 and { error } when the API is unreachable,
 * so pages can render an empty state instead of failing (the API is not reachable during `next build`).
 */
async function publicGet(path, { revalidate = REVALIDATE_SECONDS } = {}) {
  try {
    const res = await fetch(`${serverApiUrl()}${path}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404) return { notFound: true };
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return { data: await res.json() };
  } catch (err) {
    return { error: err?.message || 'fetch failed' };
  }
}

export async function fetchCourses({ q = '', page = 1, limit = 24, revalidate } = {}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('page', String(page));
  params.set('limit', String(limit));
  return publicGet(`/courses?${params}`, { revalidate });
}

// Next hands dynamic params over still percent-encoded when they contain non-ASCII (Arabic slugs),
// so decode once before encoding; otherwise the API receives a double-encoded slug and answers 404.
function decodeSlug(slug) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export async function fetchCourse(slug) {
  return publicGet(`/courses/${encodeURIComponent(decodeSlug(slug))}`);
}

/** { supportWhatsapp, privacyUrl, termsUrl, deviceReplaceCooldownDays }, cached as long as the API allows (5 min). */
export async function fetchAppConfig() {
  return publicGet('/app-config', { revalidate: 300 });
}
