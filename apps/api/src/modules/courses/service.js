import crypto from 'node:crypto';
import path from 'node:path';
import mongoose from 'mongoose';
import { COURSE_STATUS, ERROR_CODES, ROLES } from '@lp/shared';
import { assertCourseOwner, isStaff } from '../../middleware/roles.js';
import { Course, Enrollment, Lesson, User, WatchProgress } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { removeMedia } from '../../utils/files.js';
import { courseSummary, lessonSummary } from './serialize.js';

function slugify(title) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'course'}-${crypto.randomBytes(3).toString('hex')}`;
}

export async function findCourse(idOrSlug) {
  return mongoose.isValidObjectId(idOrSlug) && /^[a-f\d]{24}$/i.test(idOrSlug)
    ? Course.findById(idOrSlug)
    : Course.findOne({ slug: idOrSlug.toLowerCase() });
}

export async function getOwnedCourse(id, user) {
  const course = await findCourse(id);
  assertCourseOwner(course, user);
  return course;
}

const canManage = (course, user) =>
  user && (user.role === ROLES.ADMIN || (user.role === ROLES.TEACHER && String(course.teacherId) === String(user._id)));

export async function listCourses({ q, teacherId, mine, page, limit }, user) {
  const filter = {};
  if (mine === 'true') {
    if (!isStaff(user)) throw AppError.forbidden();
    if (user.role === ROLES.TEACHER) filter.teacherId = user._id;
  } else {
    filter.status = COURSE_STATUS.PUBLISHED;
  }
  if (teacherId) filter.teacherId = teacherId;
  if (q) filter.$text = { $search: q };

  const [items, total] = await Promise.all([
    Course.find(filter)
      .sort(q ? { score: { $meta: 'textScore' } } : { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('teacherId', 'name'),
    Course.countDocuments(filter),
  ]);
  return { items: items.map(courseSummary), page, limit, total };
}

/** Course page: sections with lesson titles and no video links. Students see only ready lessons. */
export async function getCourseDetails(idOrSlug, user) {
  const course = await findCourse(idOrSlug);
  if (!course) throw AppError.notFound('Course not found');
  const manage = canManage(course, user);
  const student = user && user.role === ROLES.STUDENT;
  const enrollment = student
    ? await Enrollment.findOne({ userId: user._id, courseId: course._id, ...Enrollment.activeFilter() })
    : null;
  // A hidden course leaves the catalogue, but students who already have access keep it.
  const visible = course.status === COURSE_STATUS.PUBLISHED || (course.status === COURSE_STATUS.HIDDEN && enrollment);
  if (!visible && !manage) throw AppError.notFound('Course not found');

  await course.populate('teacherId', 'name');
  const lessonFilter = { courseId: course._id, ...(manage ? {} : Lesson.playableFilter()) };
  const lessons = await Lesson.find(lessonFilter).sort({ order: 1, createdAt: 1 });

  let progressByLesson = new Map();
  if (student) {
    const progress = await WatchProgress.find({ userId: user._id, courseId: course._id });
    progressByLesson = new Map(progress.map((p) => [String(p.lessonId), p]));
  }

  const sections = [...course.sections]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      id: String(s._id),
      title: s.title,
      order: s.order,
      lessons: lessons
        .filter((l) => String(l.sectionId) === String(s._id))
        .map((l) => {
          const item = lessonSummary(l, { staff: manage });
          const p = progressByLesson.get(String(l._id));
          if (p) item.progress = { positionSec: p.positionSec, completed: p.completed };
          return item;
        }),
    }));

  return {
    course: courseSummary(course),
    sections,
    canManage: Boolean(manage),
    enrollment: enrollment ? { id: String(enrollment._id), expiresAt: enrollment.expiresAt } : null,
  };
}

export async function createCourse(input, user) {
  let teacherId = user._id;
  if (input.teacherId) {
    if (user.role !== ROLES.ADMIN) throw AppError.forbidden();
    const teacher = await User.findOne({ _id: input.teacherId, role: ROLES.TEACHER });
    if (!teacher) throw AppError.badRequest(ERROR_CODES.VALIDATION, 'teacherId is not a teacher');
    teacherId = teacher._id;
  }
  const sections = (input.sections?.length ? input.sections : [{ title: 'القسم الأول' }]).map((s, i) => ({
    title: s.title,
    order: i,
  }));
  const course = await Course.create({
    title: input.title,
    slug: slugify(input.title),
    description: input.description,
    priceIqd: input.priceIqd,
    teacherId,
    sections,
  });
  return getCourseDetails(String(course._id), user);
}

export async function updateCourse(id, input, user) {
  const course = await getOwnedCourse(id, user);

  for (const field of ['title', 'description', 'priceIqd']) {
    if (input[field] !== undefined) course[field] = input[field];
  }

  if (input.sections) {
    const keptIds = new Set(input.sections.filter((s) => s._id).map((s) => s._id));
    const removed = course.sections.filter((s) => !keptIds.has(String(s._id)));
    for (const s of removed) {
      if (await Lesson.exists({ courseId: course._id, sectionId: s._id })) {
        throw AppError.conflict(ERROR_CODES.INVALID_STATE, `Section "${s.title}" still has lessons`);
      }
    }
    const existing = new Map(course.sections.map((s) => [String(s._id), s]));
    course.sections = input.sections.map((s, i) => {
      if (s._id && !existing.has(s._id)) throw AppError.badRequest(ERROR_CODES.VALIDATION, 'Unknown section id');
      return s._id ? { _id: s._id, title: s.title, order: i } : { title: s.title, order: i };
    });
  }

  await course.save();

  if (input.lessonOrder?.length) {
    const sectionIds = new Set(course.sections.map((s) => String(s._id)));
    for (const item of input.lessonOrder) {
      if (!sectionIds.has(item.sectionId)) throw AppError.badRequest(ERROR_CODES.VALIDATION, 'Unknown section id');
    }
    await Lesson.bulkWrite(
      input.lessonOrder.map((item) => ({
        updateOne: {
          // courseId in the filter keeps a teacher from moving lessons of another course
          filter: { _id: item.lessonId, courseId: course._id },
          update: { $set: { sectionId: item.sectionId, order: item.order } },
        },
      })),
    );
  }

  return getCourseDetails(String(course._id), user);
}

export async function setPublished(id, published, user) {
  const course = await getOwnedCourse(id, user);
  course.status = published ? COURSE_STATUS.PUBLISHED : COURSE_STATUS.HIDDEN;
  await course.save();
  return { course: courseSummary(course) };
}

export async function setCover(id, file, user) {
  const course = await getOwnedCourse(id, user);
  if (!file) throw AppError.badRequest(ERROR_CODES.VALIDATION, 'file is required');
  const old = course.coverPath;
  course.coverPath = path.posix.join('covers', file.filename);
  await course.save();
  if (old) await removeMedia(old);
  return { course: courseSummary(course) };
}

/** Teacher dashboard: enrollments, watch hours and per-lesson reach. */
export async function courseStats(id, user) {
  const course = await getOwnedCourse(id, user);
  const [enrollments, perLesson] = await Promise.all([
    Enrollment.countDocuments({ courseId: course._id, ...Enrollment.activeFilter() }),
    WatchProgress.aggregate([
      { $match: { courseId: course._id } },
      {
        $group: {
          _id: '$lessonId',
          viewers: { $sum: 1 },
          completions: { $sum: { $cond: ['$completed', 1, 0] } },
          watchedSec: { $sum: '$watchedSec' },
        },
      },
    ]),
  ]);
  const lessons = await Lesson.find({ courseId: course._id }, 'title order sectionId').sort({ order: 1 });
  const byLesson = new Map(perLesson.map((r) => [String(r._id), r]));
  const totalWatchedSec = perLesson.reduce((sum, r) => sum + r.watchedSec, 0);
  return {
    activeEnrollments: enrollments,
    watchHours: Math.round((totalWatchedSec / 3600) * 10) / 10,
    lessons: lessons.map((l) => {
      const r = byLesson.get(String(l._id));
      return {
        id: String(l._id),
        title: l.title,
        viewers: r?.viewers ?? 0,
        completions: r?.completions ?? 0,
        watchHours: r ? Math.round((r.watchedSec / 3600) * 10) / 10 : 0,
      };
    }),
  };
}

/** Recomputes lessonsCount/totalDurationSec from playable lessons (the worker does the same after a transcode). */
export async function refreshCourseStats(courseId) {
  const [agg] = await Lesson.aggregate([
    { $match: { courseId: new mongoose.Types.ObjectId(String(courseId)), ...Lesson.playableFilter() } },
    { $group: { _id: null, count: { $sum: 1 }, duration: { $sum: { $ifNull: ['$video.durationSec', 0] } } } },
  ]);
  await Course.updateOne(
    { _id: courseId },
    { $set: { 'stats.lessonsCount': agg?.count ?? 0, 'stats.totalDurationSec': Math.round(agg?.duration ?? 0) } },
  );
}
