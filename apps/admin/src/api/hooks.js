import { useEffect, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LESSON_STATUS, ROLES } from '@lp/shared';
import { api, session } from './client.js';

export function useSession() {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  return { ...state, isAdmin: state.user?.role === ROLES.ADMIN };
}

// Query keys in one place so mutations invalidate the right caches.
export const keys = {
  myCourses: ['courses', 'mine'],
  course: (id) => ['course', id],
  courseStats: (id) => ['course-stats', id],
  lessonStatus: (id) => ['lesson-status', id],
  adminStats: ['admin', 'stats'],
  users: (params) => ['admin', 'users', params],
  user: (id) => ['admin', 'user', id],
  codeBatches: (courseId) => ['admin', 'codes', courseId || 'all'],
  enrollments: (params) => ['admin', 'enrollments', params],
};

/** Teacher: own courses. Admin: all courses. (100 is the API's max page size.) */
export function useMyCourses() {
  return useQuery({
    queryKey: keys.myCourses,
    queryFn: () => api('/courses', { query: { mine: 'true', limit: 100 } }),
  });
}

const TERMINAL = [LESSON_STATUS.READY, LESSON_STATUS.FAILED, LESSON_STATUS.DRAFT];
// 404 (lesson deleted), 403…: asking again won't help. Network/5xx errors are transient, so polling goes on.
const isClientError = (err) => err?.status >= 400 && err?.status < 500;

/**
 * Polls GET /lessons/:id/status every 3 s while `enabled`, until the lesson is ready/failed or the request fails
 * with a client error. Either way the course is then refetched so the editor shows the new data (or drops the lesson).
 */
export function useLessonStatus(lessonId, courseId, enabled) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: keys.lessonStatus(lessonId),
    queryFn: () => api(`/lessons/${lessonId}/status`),
    enabled: Boolean(enabled && lessonId),
    staleTime: 0, // re-enabling (reprocess, new upload) must fetch instead of trusting an old "ready"
    refetchInterval: (q) => (TERMINAL.includes(q.state.data?.status) || isClientError(q.state.error) ? false : 3000),
    refetchIntervalInBackground: true,
  });
  const status = query.data?.status;
  const gone = isClientError(query.error);
  useEffect(() => {
    if (enabled && courseId && (gone || status === LESSON_STATUS.READY || status === LESSON_STATUS.FAILED)) {
      qc.invalidateQueries({ queryKey: keys.course(courseId) });
      qc.invalidateQueries({ queryKey: keys.myCourses });
    }
  }, [enabled, status, gone, courseId, qc]);
  return query.data;
}
