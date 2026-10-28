// HTTP client + session: access token in memory, refresh token in localStorage,
// single-flight refresh on TOKEN_EXPIRED, logout on REFRESH_INVALID / DEVICE_REVOKED.
import { ERROR_CODES, ROLES, errorMessage } from '@lp/shared';
import { API_URL } from '../config.js';

const REFRESH_KEY = 'lp_admin_refresh_token';
const DEVICE_KEY = 'lp_admin_device_id';
const STAFF_ROLES = [ROLES.TEACHER, ROLES.ADMIN];
// Codes after which the stored session is useless.
const SESSION_DEAD_CODES = [
  ERROR_CODES.REFRESH_INVALID,
  ERROR_CODES.DEVICE_REVOKED,
  ERROR_CODES.ACCOUNT_SUSPENDED,
  ERROR_CODES.UNAUTHORIZED,
];

export class ApiError extends Error {
  constructor(status, code, { message, details } = {}) {
    super(message || errorMessage(code));
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details || [];
  }
}

const networkError = () => new ApiError(0, 'NETWORK', { message: 'تعذّر الاتصال بالخادم، تحقّق من الإنترنت وحاول مجدداً' });

// ---- storage helpers (localStorage can throw in private mode) ----
const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

function randomId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Stable per-browser device id (8–128 chars), created on first use. */
export function getDeviceId() {
  let id = store.get(DEVICE_KEY);
  if (!id || id.length < 8) {
    id = `web-${randomId()}`;
    store.set(DEVICE_KEY, id);
  }
  return id;
}

function deviceName() {
  const ua = navigator.userAgent || '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
  return `لوحة التحكم - ${browser}${os ? ` / ${os}` : ''}`;
}

// ---- session state (subscribed to by React through useSyncExternalStore) ----
let accessToken = null;
let accessExpiresAt = 0; // ms epoch
let state = { status: 'loading', user: null, notice: null };
const listeners = new Set();
const endListeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const session = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,
  /** Called whenever the session ends (logout, revoked device…). */
  onEnd(listener) {
    endListeners.add(listener);
    return () => endListeners.delete(listener);
  },
};

function decodeJwtExp(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=')));
    return json.exp ? json.exp * 1000 : Date.now() + 14 * 60 * 1000;
  } catch {
    return Date.now() + 14 * 60 * 1000;
  }
}

function applyAuthResult(result) {
  accessToken = result.accessToken;
  accessExpiresAt = decodeJwtExp(result.accessToken);
  store.set(REFRESH_KEY, result.refreshToken);
  setState({ status: 'authenticated', user: result.user, notice: null });
}

function clearSession(notice = null) {
  const wasAuthenticated = state.status === 'authenticated';
  accessToken = null;
  accessExpiresAt = 0;
  store.remove(REFRESH_KEY);
  setState({ status: 'anonymous', user: null, notice });
  if (wasAuthenticated) endListeners.forEach((l) => l());
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function codeFromStatus(status) {
  if (status === 401) return ERROR_CODES.UNAUTHORIZED;
  if (status === 403) return ERROR_CODES.FORBIDDEN;
  if (status === 404) return ERROR_CODES.NOT_FOUND;
  if (status === 409) return ERROR_CODES.CONFLICT;
  if (status === 429) return ERROR_CODES.RATE_LIMITED;
  if (status === 400) return ERROR_CODES.VALIDATION;
  return ERROR_CODES.INTERNAL;
}

async function errorFromResponse(res) {
  const body = await readJson(res);
  const code = body?.error?.code || codeFromStatus(res.status);
  return new ApiError(res.status, code, { details: body?.error?.details });
}

// ---- refresh (single flight inside the tab, serialized across tabs with Web Locks) ----
let refreshPromise = null;

async function doRefresh() {
  // Read the token inside the lock: another tab may have rotated it while we waited.
  const refreshToken = store.get(REFRESH_KEY);
  if (!refreshToken) {
    clearSession();
    throw new ApiError(401, ERROR_CODES.REFRESH_INVALID);
  }
  let res;
  try {
    res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    throw networkError();
  }
  if (!res.ok) {
    const err = await errorFromResponse(res);
    // 400 = malformed stored token; 401/403 = revoked, suspended… Network/5xx errors keep the session.
    if (SESSION_DEAD_CODES.includes(err.code) || err.status === 400 || err.status === 401) clearSession(err.message);
    throw err;
  }
  const result = await res.json();
  if (!STAFF_ROLES.includes(result.user?.role)) {
    clearSession('هذه اللوحة مخصّصة للمدرّسين والإدارة فقط');
    throw new ApiError(403, ERROR_CODES.FORBIDDEN);
  }
  applyAuthResult(result);
  return accessToken;
}

/** Refreshes the access token. Parallel callers share one request. */
export function refreshSession() {
  if (!refreshPromise) {
    const run = () => doRefresh();
    const locked = globalThis.navigator?.locks ? navigator.locks.request('lp-admin-refresh', run) : run();
    refreshPromise = locked.finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Returns an access token valid for at least `minValidityMs`, refreshing first if needed. */
export async function getFreshAccessToken(minValidityMs = 60_000) {
  if (accessToken && accessExpiresAt - Date.now() > minValidityMs) return accessToken;
  return refreshSession();
}

/** Forces the next getFreshAccessToken() to refresh (used when the server says the token expired). */
export function invalidateAccessToken(token) {
  if (!token || token === accessToken) {
    accessToken = null;
    accessExpiresAt = 0;
  }
}

// ---- public auth API ----
export async function bootstrapSession() {
  if (!store.get(REFRESH_KEY)) {
    setState({ status: 'anonymous' });
    return;
  }
  try {
    await refreshSession();
  } catch (err) {
    // On a network error keep the refresh token so a reload can retry; just show the login screen.
    if (state.status === 'loading') setState({ status: 'anonymous', notice: err.message });
  }
}

export async function login(phone, password) {
  const result = await api('/auth/login', {
    method: 'POST',
    auth: false,
    body: { phone, password, deviceId: getDeviceId(), deviceName: deviceName(), platform: 'web', audience: 'staff' },
  });
  if (!STAFF_ROLES.includes(result.user?.role)) {
    // End the session we just opened; students use the website / app instead.
    fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${result.accessToken}` } }).catch(() => {});
    throw new ApiError(403, ERROR_CODES.FORBIDDEN, {
      message: 'هذه اللوحة مخصّصة للمدرّسين والإدارة فقط. يمكن للطلاب استخدام الموقع أو التطبيق.',
    });
  }
  applyAuthResult(result);
  return result.user;
}

export async function logout() {
  const token = accessToken;
  if (token) {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    } catch {
      /* best effort */
    }
  }
  clearSession();
}

// ---- requests ----
function buildUrl(path, query) {
  const url = new URL(`${API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Calls the API. `body` is sent as JSON, `form` as multipart (FormData).
 * Returns parsed JSON, null for 204, or the raw Response when `raw` is true.
 */
export async function api(path, { method = 'GET', body, form, query, signal, raw = false, auth = true } = {}) {
  const url = buildUrl(path, query);

  const send = async (token) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    try {
      return await fetch(url, { method, headers, body: payload, signal });
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      throw networkError();
    }
  };

  let token = auth ? await getFreshAccessToken() : null;
  let res = await send(token);

  if (auth && res.status === 401) {
    const err = await errorFromResponse(res.clone());
    if (err.code === ERROR_CODES.TOKEN_EXPIRED) {
      // If a parallel request already refreshed, the new token is reused; otherwise refresh once (shared).
      invalidateAccessToken(token);
      token = await getFreshAccessToken();
      res = await send(token);
    }
  }

  if (!res.ok) {
    const err = await errorFromResponse(res);
    if (auth && (err.code === ERROR_CODES.DEVICE_REVOKED || err.code === ERROR_CODES.REFRESH_INVALID || err.code === ERROR_CODES.ACCOUNT_SUSPENDED)) {
      clearSession(err.message);
    }
    throw err;
  }
  if (raw) return res;
  if (res.status === 204) return null;
  return readJson(res);
}

/** Downloads an authenticated file (CSV) through fetch + Blob URL. */
export async function downloadFile(path, { method = 'GET', body, query, filename }) {
  const res = await api(path, { method, body, query, raw: true });
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
