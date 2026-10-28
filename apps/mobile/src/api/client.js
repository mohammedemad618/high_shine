import { ERROR_CODES } from '@lp/shared';
import { useAuth } from '../store/auth';

// EXPO_PUBLIC_* vars are inlined at bundle time (eas.json sets them per build profile). The 10.0.2.2 fallback
// (the host machine from the Android emulator) is for development only: a release without the variable fails
// loudly at start-up instead of shipping an app that cannot reach the server.
if (!process.env.EXPO_PUBLIC_API_URL && !__DEV__) throw new Error('EXPO_PUBLIC_API_URL is not set for this build');
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000/api/v1').replace(/\/+$/, '');

const REQUEST_TIMEOUT_MS = 20000;

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const SESSION_ENDING_CODES = new Set([ERROR_CODES.DEVICE_REVOKED, ERROR_CODES.REFRESH_INVALID]);

function buildUrl(path, query) {
  const url = `${API_URL}${path}`;
  if (!query) return url;
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return params.length ? `${url}?${params.join('&')}` : url;
}

async function send(path, { method = 'GET', body, query, token }) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Network request failed');
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error || {};
    throw new ApiError(res.status, err.code || ERROR_CODES.INTERNAL, err.message, err.details);
  }
  return data;
}

// Single-flight refresh: parallel requests that hit TOKEN_EXPIRED all wait on the same promise,
// so the rotated refresh token is only spent once.
let refreshing = null;

async function doRefresh() {
  const { refreshToken, setTokens, clearSession } = useAuth.getState();
  if (!refreshToken) {
    await clearSession();
    throw new ApiError(401, ERROR_CODES.REFRESH_INVALID);
  }
  try {
    const result = await send('/auth/refresh', { method: 'POST', body: { refreshToken } });
    await setTokens(result);
    return result.accessToken;
  } catch (err) {
    // Network failures keep the session; anything the server rejects ends it.
    if (err.status === 401 || err.status === 403 || SESSION_ENDING_CODES.has(err.code)) await clearSession();
    throw err;
  }
}

export function refreshAccessToken() {
  if (!refreshing) refreshing = doRefresh().finally(() => (refreshing = null));
  return refreshing;
}

/**
 * JSON request against the API. `auth` (default true) attaches the access token, refreshes it once on any 401
 * (expired, or no longer accepted, e.g. after a key change) and logs out on DEVICE_REVOKED / REFRESH_INVALID or
 * when the refresh itself is refused, so the app never stays stuck on a dead session.
 */
export async function api(path, { auth = true, ...options } = {}) {
  if (!auth) return send(path, options);
  try {
    try {
      return await send(path, { ...options, token: useAuth.getState().accessToken });
    } catch (err) {
      if (err.status !== 401) throw err;
      const token = await refreshAccessToken();
      return await send(path, { ...options, token });
    }
  } catch (err) {
    if (SESSION_ENDING_CODES.has(err.code)) await useAuth.getState().clearSession();
    throw err;
  }
}
