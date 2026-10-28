// Browser-side API client: device id, token storage, single-flight refresh, Arabic errors.
import { ERROR_CODES, errorMessage } from '@lp/shared';
import { PUBLIC_API_URL } from './config.js';

const KEYS = {
  deviceId: 'lp.deviceId',
  access: 'lp.accessToken',
  refresh: 'lp.refreshToken',
  user: 'lp.user',
};
export const SESSION_STORAGE_KEYS = [KEYS.access, KEYS.refresh, KEYS.user];

// These end the session on this browser: the refresh token is dead or the device was unbound.
const LOGOUT_CODES = new Set([ERROR_CODES.REFRESH_INVALID, ERROR_CODES.DEVICE_REVOKED, ERROR_CODES.ACCOUNT_SUSPENDED]);

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Arabic text for any error thrown by this module. */
export function errorText(err) {
  if (err?.code === 'NETWORK') return 'تعذّر الاتصال بالخادم، تحقق من الإنترنت وحاول مجدداً';
  return errorMessage(err?.code);
}

// ---------- storage ----------

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // storage blocked (private mode): the session lives only as long as the page
  }
}

function randomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Stable per-browser id, sent on every login/register (counts toward the account's device limit). */
export function getDeviceId() {
  let id = read(KEYS.deviceId);
  if (!id || id.length < 8) {
    id = `web-${randomId()}`;
    write(KEYS.deviceId, id);
  }
  return id;
}

function deviceName() {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'متصفح';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad|iPod/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return `${browser}${os ? ` - ${os}` : ''}`.slice(0, 100);
}

// ---------- session ----------

const listeners = new Set();

/** Subscribe to login/logout/refresh on this tab. Returns an unsubscribe function. */
export function onSessionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(event) {
  for (const fn of listeners) fn(event);
}

export function getStoredUser() {
  const raw = read(KEYS.user);
  if (!raw || !read(KEYS.refresh)) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSession({ user, accessToken, refreshToken }) {
  write(KEYS.access, accessToken);
  write(KEYS.refresh, refreshToken);
  if (user) write(KEYS.user, JSON.stringify(user));
  emit({ type: 'login', user: user || getStoredUser() });
}

export function updateStoredUser(user) {
  write(KEYS.user, JSON.stringify(user));
  emit({ type: 'user', user });
}

export function clearSession(reason = null) {
  const hadSession = Boolean(read(KEYS.refresh));
  write(KEYS.access, null);
  write(KEYS.refresh, null);
  write(KEYS.user, null);
  if (hadSession) emit({ type: 'logout', user: null, reason });
}

/** Reads the `exp` claim of a JWT without verifying it (only to refresh a little before expiry). */
function tokenExpiresAt(token) {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=')));
    return typeof json.exp === 'number' ? json.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

const isExpiring = (token, marginMs = 30_000) => tokenExpiresAt(token) - Date.now() < marginMs;

// ---------- transport ----------

async function parseError(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON error (proxy page, empty body)
  }
  const e = body?.error;
  const fallback = res.status === 401 ? ERROR_CODES.UNAUTHORIZED : res.status === 404 ? ERROR_CODES.NOT_FOUND : ERROR_CODES.INTERNAL;
  return new ApiError(res.status, e?.code || fallback, e?.message, e?.details);
}

async function send(path, { method = 'GET', body, token, keepalive, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(`${PUBLIC_API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive,
      signal,
      cache: 'no-store',
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', err?.message);
  }
}

// ---------- refresh (single flight, also across tabs) ----------

let refreshPromise = null;

function withCrossTabLock(fn) {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request('lp-auth-refresh', fn);
  }
  return fn();
}

/**
 * Swaps the refresh token for a new pair. Refresh tokens rotate and replaying an old one revokes every session
 * on the device, so only one refresh may run at a time: one promise per tab, plus a Web Lock across tabs.
 */
function refreshAccessToken(staleAccessToken) {
  if (!refreshPromise) {
    refreshPromise = withCrossTabLock(async () => {
      // Another tab may have refreshed while we waited for the lock.
      const current = read(KEYS.access);
      if (current && current !== staleAccessToken && !isExpiring(current)) return current;

      const refreshToken = read(KEYS.refresh);
      if (!refreshToken) {
        clearSession(ERROR_CODES.REFRESH_INVALID);
        throw new ApiError(401, ERROR_CODES.REFRESH_INVALID);
      }
      const res = await send('/auth/refresh', { method: 'POST', body: { refreshToken } });
      if (!res.ok) {
        const err = await parseError(res);
        // 401/403 from refresh always means the session is over; 5xx/network keep it for a retry.
        if (LOGOUT_CODES.has(err.code) || res.status === 401 || res.status === 403) clearSession(err.code);
        throw err;
      }
      const data = await res.json();
      saveSession(data);
      return data.accessToken;
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** A valid access token (refreshed when it is about to expire), or null when logged out. */
export async function getFreshAccessToken() {
  const token = read(KEYS.access);
  if (!token) return read(KEYS.refresh) ? refreshAccessToken(null) : null;
  return isExpiring(token) ? refreshAccessToken(token) : token;
}

/**
 * Calls the API.
 * auth: true (required), 'optional' (send the token when logged in) or false.
 */
export async function api(path, { method = 'GET', body, auth = true, keepalive, signal } = {}) {
  let token = null;
  if (auth) {
    try {
      token = await getFreshAccessToken();
    } catch (err) {
      if (auth === true) throw err;
    }
    if (auth === true && !token) throw new ApiError(401, ERROR_CODES.UNAUTHORIZED);
  }

  let res = await send(path, { method, body, token, keepalive, signal });

  if (res.status === 401 && token) {
    const err = await parseError(res);
    if (err.code !== ERROR_CODES.TOKEN_EXPIRED) {
      if (LOGOUT_CODES.has(err.code)) clearSession(err.code);
      throw err;
    }
    token = await refreshAccessToken(token);
    res = await send(path, { method, body, token, keepalive, signal });
  }

  if (!res.ok) {
    const err = await parseError(res);
    if (LOGOUT_CODES.has(err.code)) clearSession(err.code);
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

/**
 * Fire-and-forget POST that survives page unload (keepalive). Uses the current access token as-is because
 * there is no time to refresh while the page is going away. sendBeacon cannot carry the Authorization header.
 */
export function postOnUnload(path, body) {
  const token = read(KEYS.access);
  if (!token) return;
  try {
    fetch(`${PUBLIC_API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}

// ---------- auth endpoints ----------

export async function login({ phone, password }) {
  const data = await api('/auth/login', {
    method: 'POST',
    auth: false,
    body: { phone, password, deviceId: getDeviceId(), deviceName: deviceName(), platform: 'web' },
  });
  saveSession(data);
  return data.user;
}

export async function register({ name, phone, password }) {
  const data = await api('/auth/register', {
    method: 'POST',
    auth: false,
    body: { name, phone, password, deviceId: getDeviceId(), deviceName: deviceName(), platform: 'web' },
  });
  saveSession(data);
  return data.user;
}

export async function logout() {
  try {
    if (read(KEYS.refresh)) await api('/auth/logout', { method: 'POST' });
  } catch {
    // the local session is cleared either way
  }
  clearSession();
}
