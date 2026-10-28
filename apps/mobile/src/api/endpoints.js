import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { getDeviceId } from '../lib/secureStorage';
import { api } from './client';

async function deviceInfo() {
  const deviceName = (Device.deviceName || [Device.manufacturer, Device.modelName].filter(Boolean).join(' ')).slice(0, 100);
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web' ? Platform.OS : 'other';
  return { deviceId: await getDeviceId(), deviceName, platform };
}

// Auth
export async function login({ phone, password }) {
  return api('/auth/login', { auth: false, method: 'POST', body: { phone, password, ...(await deviceInfo()) } });
}

export async function register({ name, phone, password }) {
  return api('/auth/register', { auth: false, method: 'POST', body: { name, phone, password, ...(await deviceInfo()) } });
}

export const logout = () => api('/auth/logout', { method: 'POST' });
export const getMe = () => api('/me');

// Courses
export const listCourses = ({ q, page = 1, limit = 20 } = {}) => api('/courses', { query: { q, page, limit } });
export const getCourse = (idOrSlug) => api(`/courses/${encodeURIComponent(idOrSlug)}`);
export const getMyCourses = () => api('/me/courses');

// Playback
export const startPlayback = (lessonId) => api(`/lessons/${lessonId}/playback`, { method: 'POST' });
export const saveProgress = (lessonId, { positionSec, watchedDeltaSec }) =>
  api(`/lessons/${lessonId}/progress`, { method: 'POST', body: { positionSec, watchedDeltaSec } });
