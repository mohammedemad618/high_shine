// One Uppy instance for the whole app, so uploads keep running while the user navigates.
// Each video is uploaded with tus (resumable) to `${API_URL}/uploads` with meta.lessonId.
import { useSyncExternalStore } from 'react';
import Uppy from '@uppy/core';
import Tus from '@uppy/tus';
import { ERROR_CODES, UPLOAD_CHUNK_BYTES, errorMessage } from '@lp/shared';
import { API_URL } from '../config.js';
import { getFreshAccessToken, invalidateAccessToken } from '../api/client.js';

/**
 * Upload item shown in the UI:
 * { id, lessonId, courseId, title, name, size, percent, state, error, addedAt }
 * state: queued | uploading | offline | error | done
 */
let items = {};
let snapshot = [];
const listeners = new Set();
const doneListeners = new Set();
const cancelListeners = new Set();

/** Called with the item when a file has been fully uploaded (the lesson is now queued for processing). */
export function onUploadDone(listener) {
  doneListeners.add(listener);
  return () => doneListeners.delete(listener);
}

/** Called with the item when the user cancels an upload (the server then restores the lesson's previous state). */
export function onUploadCancelled(listener) {
  cancelListeners.add(listener);
  return () => cancelListeners.delete(listener);
}

function emit() {
  snapshot = Object.values(items).sort((a, b) => a.addedAt - b.addedAt);
  listeners.forEach((l) => l());
}

function patch(id, changes) {
  if (!items[id]) return;
  items[id] = { ...items[id], ...changes };
  emit();
}

function responseCode(err) {
  try {
    const body = err?.originalResponse?.getBody?.();
    return body ? JSON.parse(body)?.error?.code : undefined;
  } catch {
    return undefined;
  }
}

function describeError(err, response) {
  const status = response?.status ?? err?.originalResponse?.getStatus?.();
  const code = responseCode(err) || responseCode(err?.cause);
  if (code) return errorMessage(code);
  if (!status) return 'انقطع الاتصال أثناء الرفع. اضغط «إعادة المحاولة» ليُستأنف من حيث توقف.';
  if (status === 413) return 'حجم الملف أكبر من المسموح';
  return errorMessage(status === 403 ? ERROR_CODES.FORBIDDEN : status === 404 ? ERROR_CODES.NOT_FOUND : ERROR_CODES.INTERNAL);
}

let uppy = null;

function getUppy() {
  if (uppy) return uppy;
  uppy = new Uppy({ id: 'lesson-videos', autoProceed: false, allowMultipleUploadBatches: true });

  uppy.use(Tus, {
    endpoint: `${API_URL}/uploads`,
    chunkSize: UPLOAD_CHUNK_BYTES,
    // Long backoff so short network drops resume by themselves (the delay index resets once bytes move again).
    retryDelays: [0, 1000, 3000, 5000, 10000, 20000, 30000, 60000, 60000],
    limit: 2, // parallel files
    // Forget the resume URL once done, so re-uploading the same file to the same lesson starts a new upload.
    removeFingerprintOnSuccess: true,
    // Only what the API needs; `relativePath` (used below for the fingerprint) stays on the client.
    allowedMetaFields: ['lessonId', 'filename'],
    // Every tus request (POST, HEAD, PATCH) gets a fresh token: the access token lives 15 min, uploads take longer.
    async onBeforeRequest(req) {
      const token = await getFreshAccessToken(2 * 60_000);
      req.setHeader('Authorization', `Bearer ${token}`);
    },
    onShouldRetry(err, retryAttempt, _options, next) {
      const status = err?.originalResponse?.getStatus?.();
      if (status === 401) {
        // Clock skew or a token that expired mid-flight: refresh and try again a couple of times.
        if (responseCode(err) === ERROR_CODES.TOKEN_EXPIRED && retryAttempt < 3) {
          invalidateAccessToken();
          return true;
        }
        return false;
      }
      return next(err);
    },
  });

  uppy.on('upload-progress', (file, progress) => {
    if (!file || !items[file.id]) return;
    const total = progress.bytesTotal || file.size || 0;
    const uploaded = progress.bytesUploaded || 0;
    patch(file.id, {
      state: items[file.id].state === 'offline' ? 'offline' : 'uploading',
      percent: total ? Math.min(100, Math.floor((uploaded / total) * 100)) : 0,
      error: null,
    });
  });

  uppy.on('upload-success', (file) => {
    if (!file || !items[file.id]) return;
    patch(file.id, { state: 'done', percent: 100, error: null });
    doneListeners.forEach((l) => l(items[file.id]));
  });

  uppy.on('upload-error', (file, error, response) => {
    if (file) patch(file.id, { state: 'error', error: describeError(error, response) });
  });

  uppy.on('upload-retry', (file) => {
    const id = typeof file === 'string' ? file : file?.id;
    if (id) patch(id, { state: 'uploading', error: null });
  });

  // Finished files are dropped from Uppy (the UI keeps its own item) so the same file can be added again later.
  uppy.on('complete', (result) => {
    for (const f of result?.successful ?? []) {
      if (uppy.getFile(f.id)) uppy.removeFile(f.id);
    }
  });

  uppy.on('is-offline', () => {
    for (const item of Object.values(items)) {
      if (item.state === 'uploading' || item.state === 'queued') patch(item.id, { state: 'offline' });
    }
  });

  uppy.on('is-online', () => {
    let needsRetry = false;
    for (const item of Object.values(items)) {
      if (item.state === 'offline') patch(item.id, { state: 'uploading' });
      if (item.state === 'error') needsRetry = true;
    }
    // Files that gave up while offline resume from the last uploaded chunk.
    if (needsRetry) uppy.retryAll().catch(() => {});
  });

  return uppy;
}

/**
 * Queues `file` for upload into an existing lesson and starts uploading.
 * `relativePath` makes the Uppy file id — and so the tus resume fingerprint — unique per lesson:
 * re-picking the same file for the same lesson (e.g. after a page reload) resumes the earlier upload.
 */
export function uploadLessonVideo({ file, lessonId, courseId, title }) {
  const u = getUppy();
  for (const existing of u.getFiles()) {
    if (existing.meta.lessonId === lessonId) u.removeFile(existing.id);
  }
  const id = u.addFile({
    name: file.name,
    type: file.type,
    data: file,
    source: 'local',
    isRemote: false,
    meta: { relativePath: `lesson-${lessonId}/${file.name}`, lessonId, filename: file.name },
  });
  items[id] = {
    id,
    lessonId,
    courseId,
    title: title || file.name,
    name: file.name,
    size: file.size,
    percent: 0,
    state: navigator.onLine === false ? 'offline' : 'queued',
    error: null,
    addedAt: Date.now(),
  };
  emit();
  u.upload().catch(() => {
    /* per-file errors arrive through 'upload-error' */
  });
  return id;
}

export function retryUpload(id) {
  if (!uppy?.getFile(id)) return;
  patch(id, { state: 'uploading', error: null });
  uppy.retryUpload(id).catch(() => {});
}

/**
 * Stops an upload and discards its partial data on the server (tus DELETE, which also forgets the resume URL,
 * so picking the file again starts from 0%).
 */
export function cancelUpload(id) {
  const item = items[id];
  if (uppy?.getFile(id)) uppy.removeFile(id);
  delete items[id];
  emit();
  if (item) cancelListeners.forEach((l) => l(item));
}

export function dismissUpload(id) {
  if (items[id]?.state !== 'done') return;
  delete items[id];
  emit();
}

export function clearFinishedUploads() {
  for (const item of Object.values(items)) if (item.state === 'done') delete items[item.id];
  emit();
}

/** Aborts everything (used on logout). */
export function resetUploads() {
  if (uppy) uppy.cancelAll();
  items = {};
  emit();
}

export const isActive = (item) => item.state !== 'done' && item.state !== 'error';

/** Whether a file is still uploading in this tab; read on demand (beforeunload, logout) rather than subscribed to. */
export const hasActiveUploads = () => snapshot.some(isActive);

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnapshot = () => snapshot;

export function useUploads() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** The latest local upload for a lesson in this browser session, if any. */
export function useLessonUpload(lessonId) {
  const all = useUploads();
  for (let i = all.length - 1; i >= 0; i--) if (all[i].lessonId === lessonId) return all[i];
  return null;
}

// Warn before closing the tab while an upload is running (it can be resumed, but only by re-picking the file).
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (hasActiveUploads()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}
