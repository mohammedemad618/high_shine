// Helpers that keep the cached CourseDetails in sync after mutations.
import { keys } from '../../api/hooks.js';

export function setCourseDetails(qc, courseId, details) {
  qc.setQueryData(keys.course(courseId), details);
  qc.invalidateQueries({ queryKey: keys.myCourses });
}

export function setCourseSummary(qc, courseId, course) {
  qc.setQueryData(keys.course(courseId), (old) => (old ? { ...old, course } : old));
  qc.invalidateQueries({ queryKey: keys.myCourses });
}

/** Replaces one lesson (staff shape) inside the cached course. */
export function setLesson(qc, courseId, lesson) {
  qc.setQueryData(keys.course(courseId), (old) => {
    if (!old) return old;
    return {
      ...old,
      sections: old.sections.map((s) => ({
        ...s,
        lessons: s.lessons.map((l) => (l.id === lesson.id ? { ...l, ...lesson } : l)),
      })),
    };
  });
}

/** Payload for PATCH /courses/:id `sections` (full ordered list). */
export const sectionsPayload = (sections) => sections.map((s) => (s.id ? { _id: s.id, title: s.title } : { title: s.title }));
