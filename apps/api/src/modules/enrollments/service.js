import { COURSE_STATUS, ENROLLMENT_SOURCE, ENROLLMENT_STATUS, ERROR_CODES } from '@lp/shared';
import { withTransaction } from '../../db/transactions.js';
import { ActivationCode, Course, Enrollment, Lesson, WatchProgress } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { courseSummary } from '../courses/serialize.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Creates the enrollment, or extends a time-limited one. Runs inside the caller's transaction.
 * durationDays null = permanent.
 */
export async function grantEnrollment({ userId, courseId, durationDays, source, activationCodeId = null }, session) {
  const now = new Date();
  const existing = await Enrollment.findOne({ userId, courseId }).session(session);

  if (existing && existing.status === ENROLLMENT_STATUS.ACTIVE && existing.expiresAt === null) {
    throw AppError.conflict(ERROR_CODES.ALREADY_ENROLLED);
  }

  let expiresAt = null;
  if (durationDays) {
    const stillActive = existing?.status === ENROLLMENT_STATUS.ACTIVE && existing.expiresAt > now;
    const from = stillActive ? existing.expiresAt : now;
    expiresAt = new Date(from.getTime() + durationDays * DAY_MS);
  }

  return Enrollment.findOneAndUpdate(
    { userId, courseId },
    {
      $set: { status: ENROLLMENT_STATUS.ACTIVE, expiresAt, source, activationCodeId },
      $setOnInsert: { startsAt: now },
    },
    { upsert: true, returnDocument: 'after', session },
  );
}

/**
 * Redeems an activation code. Consuming the code and creating the enrollment happen in one transaction,
 * so a code can never be used more times than maxUses, even under concurrent requests.
 */
export async function redeem(code, user) {
  const result = await withTransaction(async (session) => {
    const now = new Date();
    const activation = await ActivationCode.findOneAndUpdate(
      {
        code,
        $expr: { $lt: ['$usedCount', '$maxUses'] },
        'redeemedBy.userId': { $ne: user._id },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      },
      { $inc: { usedCount: 1 }, $push: { redeemedBy: { userId: user._id, at: now } } },
      { returnDocument: 'after', session },
    );

    if (!activation) {
      const found = await ActivationCode.findOne({ code }).session(session);
      if (!found) throw AppError.badRequest(ERROR_CODES.CODE_INVALID);
      if (found.redeemedBy.some((r) => String(r.userId) === String(user._id))) {
        throw AppError.conflict(ERROR_CODES.CODE_ALREADY_REDEEMED);
      }
      if (found.expiresAt && found.expiresAt <= now) throw AppError.badRequest(ERROR_CODES.CODE_EXPIRED);
      throw AppError.conflict(ERROR_CODES.CODE_USED_UP);
    }

    // Codes already sold keep working when a course is hidden from the catalogue; only drafts refuse them.
    const course = await Course.findById(activation.courseId).session(session);
    if (!course || course.status === COURSE_STATUS.DRAFT) throw AppError.conflict(ERROR_CODES.COURSE_NOT_PUBLISHED);

    const enrollment = await grantEnrollment(
      {
        userId: user._id,
        courseId: course._id,
        durationDays: activation.durationDays,
        source: ENROLLMENT_SOURCE.CODE,
        activationCodeId: activation._id,
      },
      session,
    );
    return { course, enrollment };
  });

  return {
    course: courseSummary(result.course),
    enrollment: { id: String(result.enrollment._id), expiresAt: result.enrollment.expiresAt },
  };
}

/** "My courses": active enrollments with completion % and the lesson to continue from. */
export async function myCourses(user) {
  const enrollments = await Enrollment.find({ userId: user._id, ...Enrollment.activeFilter() }).sort({ updatedAt: -1 });
  const courseIds = enrollments.map((e) => e.courseId);
  const [courses, progress] = await Promise.all([
    Course.find({ _id: { $in: courseIds } }).populate('teacherId', 'name'),
    WatchProgress.find({ userId: user._id, courseId: { $in: courseIds } }).sort({ updatedAt: -1 }),
  ]);
  const lastLessonIds = new Map();
  for (const p of progress) if (!lastLessonIds.has(String(p.courseId))) lastLessonIds.set(String(p.courseId), p.lessonId);
  const lastLessons = await Lesson.find({ _id: { $in: [...lastLessonIds.values()] } }, 'title');
  const lessonTitle = new Map(lastLessons.map((l) => [String(l._id), l.title]));
  const courseById = new Map(courses.map((c) => [String(c._id), c]));

  return {
    items: enrollments
      .filter((e) => courseById.has(String(e.courseId)))
      .map((e) => {
        const course = courseById.get(String(e.courseId));
        const courseProgress = progress.filter((p) => String(p.courseId) === String(e.courseId));
        const completed = courseProgress.filter((p) => p.completed).length;
        const total = course.stats?.lessonsCount || 0;
        const lastLessonId = lastLessonIds.get(String(e.courseId));
        const last = courseProgress.find((p) => String(p.lessonId) === String(lastLessonId));
        return {
          course: courseSummary(course),
          enrollment: { id: String(e._id), expiresAt: e.expiresAt },
          completedLessons: completed,
          totalLessons: total,
          percent: total ? Math.min(100, Math.round((completed / total) * 100)) : 0,
          continueLesson: lastLessonId
            ? { id: String(lastLessonId), title: lessonTitle.get(String(lastLessonId)) ?? '', positionSec: last?.positionSec ?? 0 }
            : null,
        };
      }),
  };
}
