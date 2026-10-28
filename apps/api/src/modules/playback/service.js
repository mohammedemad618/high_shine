import { COURSE_STATUS, ERROR_CODES, LESSON_STATUS, ROLES, USER_STATUS } from '@lp/shared';
import { env } from '../../config/env.js';
import { Course, Enrollment, Lesson, MediaKey, PlaybackSession, User, WatchProgress } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { signMediaPath } from '../../utils/secureLink.js';
import { signPlaybackToken, verifyPlaybackToken } from '../../utils/tokens.js';
import { masterPlaylist, variantPlaylist } from './playlist.js';

const canManage = (course, user) =>
  user.role === ROLES.ADMIN || (user.role === ROLES.TEACHER && String(course.teacherId) === String(user._id));

/**
 * Who may watch a lesson: its course's teacher and admins, anyone logged in for a free preview,
 * and students with an active enrollment. One indexed query on {userId, courseId}.
 */
export async function assertCanWatch(lesson, user) {
  const course = await Course.findById(lesson.courseId, 'teacherId status');
  if (!course) throw AppError.notFound('Course not found');
  if (canManage(course, user)) return course;
  if (course.status !== COURSE_STATUS.PUBLISHED) throw AppError.notFound('Course not found');
  if (lesson.isFreePreview) return course;
  const enrolled = await Enrollment.exists({ userId: user._id, courseId: course._id, ...Enrollment.activeFilter() });
  if (!enrolled) throw AppError.forbidden(ERROR_CODES.NOT_ENROLLED);
  return course;
}

async function claimSession(user, lessonId, deviceId, ip) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - env.playbackSessionIdleSec * 1000);
  const live = await PlaybackSession.exists({ userId: user._id, deviceId: { $ne: deviceId }, lastSeenAt: { $gt: cutoff } });
  if (live) throw AppError.conflict(ERROR_CODES.CONCURRENT_PLAYBACK);
  await PlaybackSession.deleteMany({ userId: user._id, deviceId: { $ne: deviceId } });
  return PlaybackSession.findOneAndUpdate(
    { userId: user._id, deviceId },
    { $set: { lessonId, ip, lastSeenAt: now }, $setOnInsert: { startedAt: now } },
    { upsert: true, returnDocument: 'after' },
  );
}

export async function startPlayback(lessonId, user, deviceId, ip) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw AppError.notFound('Lesson not found');
  await assertCanWatch(lesson, user);
  if (lesson.status !== LESSON_STATUS.READY) throw AppError.conflict(ERROR_CODES.LESSON_NOT_READY);

  const session = await claimSession(user, lesson._id, deviceId, ip);
  const { token, exp } = signPlaybackToken({ userId: user._id, lessonId: lesson._id, deviceId, sessionId: session._id });
  const progress = await WatchProgress.findOne({ userId: user._id, lessonId: lesson._id });

  return {
    lesson: { id: String(lesson._id), title: lesson.title, courseId: String(lesson.courseId) },
    playbackUrl: `${env.publicApiUrl}/api/v1/play/${lesson._id}/master.m3u8?t=${encodeURIComponent(token)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
    durationSec: lesson.video.durationSec,
    renditions: lesson.video.renditions.map((r) => ({ name: r.name, height: r.height })),
    resumePositionSec: progress && !progress.completed ? progress.positionSec : 0,
    watermark: { text: `${user.name} · ${user.phone}`, userId: String(user._id) },
    attachments: lesson.attachments.map((a) => ({
      id: String(a._id),
      name: a.name,
      size: a.size,
      url: signMediaPath(`/${a.path}`, exp),
    })),
  };
}

export async function getMaster(lessonId, token) {
  verifyPlaybackToken(token, lessonId);
  return masterPlaylist(lessonId, token);
}

export async function getVariant(lessonId, variant, token) {
  const payload = verifyPlaybackToken(token, lessonId);
  return variantPlaylist({
    lessonId,
    variant,
    token,
    expires: payload.exp,
    keyUrl: `${env.publicApiUrl}/api/v1/play/${lessonId}/key`,
  });
}

/** The decryption key. Re-checks the account so a suspended user or a cleared device stops working at once. */
export async function getKey(lessonId, token) {
  const payload = verifyPlaybackToken(token, lessonId);
  const user = await User.findById(payload.sub, 'status devices');
  if (!user || user.status !== USER_STATUS.ACTIVE || !user.devices.some((d) => d.deviceId === payload.did)) {
    throw AppError.unauthorized(ERROR_CODES.PLAYBACK_TOKEN_INVALID);
  }
  const mediaKey = await MediaKey.findOne({ lessonId }).select('+key');
  if (!mediaKey) throw AppError.notFound('Key not found');
  return mediaKey.key;
}
