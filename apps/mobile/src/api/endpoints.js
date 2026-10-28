import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { getDeviceId } from '../lib/secureStorage';
import { api } from './client';

async function deviceInfo() {
  const deviceName = (Device.deviceName || [Device.manufacturer, Device.modelName].filter(Boolean).join(' ')).slice(0, 100);
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web' ? Platform.OS : 'other';
  return { deviceId: await getDeviceId(), deviceName, platform };
}

// Auth. replaceDevice: after DEVICE_LIMIT, sign out the account's least recently used device and continue.
export async function login({ phone, password, replaceDevice = false }) {
  return api('/auth/login', {
    auth: false,
    method: 'POST',
    body: { phone, password, replaceDevice, ...(await deviceInfo()) },
  });
}

export async function register({ name, phone, password }) {
  return api('/auth/register', { auth: false, method: 'POST', body: { name, phone, password, ...(await deviceInfo()) } });
}

export const logout = () => api('/auth/logout', { method: 'POST' });
export const getMe = () => api('/me');
export const changePassword = ({ currentPassword, newPassword }) =>
  api('/me/password', { method: 'PATCH', body: { currentPassword, newPassword } });
export const deleteAccount = (password) => api('/me', { method: 'DELETE', body: { password } });
// Support contact and legal links, editable on the server without a store release.
export const getAppConfig = () => api('/app-config', { auth: false });

// Courses
export const listCourses = ({ q, page = 1, limit = 20 } = {}) => api('/courses', { query: { q, page, limit } });
export const getCourse = (idOrSlug) => api(`/courses/${encodeURIComponent(idOrSlug)}`);
export const getMyCourses = () => api('/me/courses');

// Playback
export const startPlayback = (lessonId) => api(`/lessons/${lessonId}/playback`, { method: 'POST' });
export const endPlayback = (lessonId) => api(`/lessons/${lessonId}/playback`, { method: 'DELETE' });
// A watermarked PDF link valid for a few minutes, requested when the student taps the file.
export const getAttachmentLink = (lessonId, attachmentId) =>
  api(`/lessons/${lessonId}/attachments/${attachmentId}/link`, { method: 'POST' });
export const saveProgress = (lessonId, { positionSec, watchedDeltaSec }) =>
  api(`/lessons/${lessonId}/progress`, { method: 'POST', body: { positionSec, watchedDeltaSec } });
