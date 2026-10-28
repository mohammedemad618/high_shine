// Helpers that keep the cached CourseDetails in sync after mutations.
import { LESSON_STATUS } from '@lp/shared';
import { api } from '../../api/client.js';
import { keys } from '../../api/hooks.js';

export function setCourseDetails(qc, courseId, details) {
  qc.setQueryData(keys.course(courseId), details);
  qc.invalidateQueries({ queryKey: keys.myCourses });
}

export function setCourseSummary(qc, courseId, course) {
  qc.setQueryData(keys.course(courseId), (old) => (old ? { ...old, course } : old));
  qc.invalidateQueries({ queryKey: keys.myCourses });
}

function updateLesson(qc, courseId, lessonId, update) {
  qc.setQueryData(keys.course(courseId), (old) => {
    if (!old) return old;
    return {
      ...old,
      sections: old.sections.map((s) => ({
        ...s,
        lessons: s.lessons.map((l) => (l.id === lessonId ? update(l) : l)),
      })),
    };
  });
}

/** Replaces one lesson (staff shape) inside the cached course. */
export function setLesson(qc, courseId, lesson) {
  updateLesson(qc, courseId, lesson.id, (l) => ({ ...l, ...lesson }));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * After a cancelled upload the server puts the lesson back to ready (a version is live), failed (an older source
 * exists) or draft. Show that at once, so the row never offers a resume that would restart at 0%, then refetch
 * once the server has left "uploading" (the tus DELETE runs in the background).
 */
export async function syncCancelledUpload(qc, { lessonId, courseId }) {
  updateLesson(qc, courseId, lessonId, (l) => {
    if (l.status !== LESSON_STATUS.UPLOADING) return l;
    const status = l.video?.live ? LESSON_STATUS.READY : l.video?.hasSource ? LESSON_STATUS.FAILED : LESSON_STATUS.DRAFT;
    return { ...l, status };
  });
  for (let i = 0; i < 5; i++) {
    await wait(1000);
    const lesson = await api(`/lessons/${lessonId}/status`).catch(() => null);
    if (lesson?.status !== LESSON_STATUS.UPLOADING) break;
  }
  qc.invalidateQueries({ queryKey: keys.course(courseId) });
}

/** Payload for PATCH /courses/:id `sections` (full ordered list). */
export const sectionsPayload = (sections) => sections.map((s) => (s.id ? { _id: s.id, title: s.title } : { title: s.title }));
