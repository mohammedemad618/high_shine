import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { COURSE_STATUS, ERROR_CODES, ROLES, USER_STATUS } from '@lp/shared';
import { env, mediaPaths } from '../../config/env.js';
import { Course, Enrollment, Lesson, MediaKey, PlaybackSession, User, WatchProgress } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../utils/logger.js';
import { signFileToken, signPlaybackToken, verifyFileToken, verifyPlaybackToken } from '../../utils/tokens.js';
import { masterPlaylist, variantPlaylist } from './playlist.js';

const canManage = (course, user) =>
  user.role === ROLES.ADMIN || (user.role === ROLES.TEACHER && String(course.teacherId) === String(user._id));

/**
 * Who may watch a lesson: its course's teacher and admins, anyone logged in for a free preview of a published
 * course, and students with an active enrollment. Hiding a course only takes it out of the catalogue: enrolled
 * students keep watching. One indexed query on {userId, courseId}.
 */
export async function assertCanWatch(lesson, user) {
  const course = await Course.findById(lesson.courseId, 'teacherId status');
  if (!course) throw AppError.notFound('Course not found');
  if (canManage(course, user)) return course;
  if (course.status === COURSE_STATUS.DRAFT) throw AppError.notFound('Course not found');
  if (course.status === COURSE_STATUS.PUBLISHED && lesson.isFreePreview) return course;
  const enrolled = await Enrollment.exists({ userId: user._id, courseId: course._id, ...Enrollment.activeFilter() });
  if (enrolled) return course;
  if (course.status !== COURSE_STATUS.PUBLISHED) throw AppError.notFound('Course not found');
  throw AppError.forbidden(ERROR_CODES.NOT_ENROLLED);
}

const liveCutoff = () => new Date(Date.now() - env.playbackSessionIdleSec * 1000);

/** True when the account is playing on a different device right now. */
export function playingElsewhere(userId, deviceId) {
  return PlaybackSession.exists({ userId, deviceId: { $ne: deviceId }, lastSeenAt: { $gt: liveCutoff() } });
}

async function claimSession(user, lessonId, deviceId, ip) {
  if (await playingElsewhere(user._id, deviceId)) throw AppError.conflict(ERROR_CODES.CONCURRENT_PLAYBACK);
  await PlaybackSession.deleteMany({ userId: user._id, deviceId: { $ne: deviceId } });
  const now = new Date();
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
  if (!lesson.video?.hlsPath) throw AppError.conflict(ERROR_CODES.LESSON_NOT_READY);

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
    // Download links are requested per tap (attachmentLink), so a copied link dies within minutes.
    attachments: lesson.attachments.map((a) => ({ id: String(a._id), name: a.name, size: a.size })),
  };
}

/**
 * The lesson screen closed: free the account at once instead of after PLAYBACK_SESSION_IDLE_SEC.
 * Scoped to the lesson, so a late call from the previous screen cannot end the next lesson's session.
 */
export async function endPlayback(lessonId, user, deviceId) {
  await PlaybackSession.deleteOne({ userId: user._id, deviceId, lessonId });
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

async function assertTokenUser(payload) {
  const user = await User.findById(payload.sub);
  if (!user || user.status !== USER_STATUS.ACTIVE || !user.devices.some((d) => d.deviceId === payload.did)) {
    throw AppError.unauthorized(ERROR_CODES.PLAYBACK_TOKEN_INVALID);
  }
  return user;
}

/**
 * The decryption key. Re-checks the account so a suspended user or a cleared device stops working at once,
 * and refuses while another device holds the account's playback session.
 */
export async function getKey(lessonId, token) {
  const payload = verifyPlaybackToken(token, lessonId);
  await assertTokenUser(payload);
  if (await playingElsewhere(payload.sub, payload.did)) throw AppError.conflict(ERROR_CODES.CONCURRENT_PLAYBACK);
  const mediaKey = await MediaKey.findOne({ lessonId }).select('+key');
  if (!mediaKey) throw AppError.notFound('Key not found');
  return mediaKey.key;
}

async function findAttachment(lessonId, attachmentId) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw AppError.notFound('Lesson not found');
  const attachment = lesson.attachments.id(attachmentId);
  if (!attachment) throw AppError.notFound('Attachment not found');
  return { lesson, attachment };
}

/** A short-lived download link for one attachment, issued only to someone allowed to watch the lesson. */
export async function attachmentLink(lessonId, attachmentId, user, deviceId) {
  const { lesson, attachment } = await findAttachment(lessonId, attachmentId);
  await assertCanWatch(lesson, user);
  const { token, exp } = signFileToken({ userId: user._id, lessonId, attachmentId: attachment._id, deviceId });
  return {
    url: `${env.publicApiUrl}/api/v1/lessons/${lessonId}/attachments/${attachment._id}/file?t=${encodeURIComponent(token)}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

// Stamps every page with the viewer's phone number, so a shared copy points back to the account that leaked it.
// Latin digits only: pdf-lib's standard fonts cannot shape Arabic.
async function watermarkPdf(bytes, text) {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.max(14, Math.min(width, height) / 20);
    for (let y = height * 0.12; y < height; y += height / 3) {
      page.drawText(text, { x: width * 0.1, y, size, font, color: rgb(0.45, 0.45, 0.45), opacity: 0.16, rotate: degrees(28) });
    }
    page.drawText(text, { x: 14, y: 10, size: 8, font, color: rgb(0.35, 0.35, 0.35), opacity: 0.55 });
  }
  return Buffer.from(await pdf.save());
}

export async function attachmentFile(lessonId, attachmentId, token) {
  const payload = verifyFileToken(token, lessonId, attachmentId);
  const user = await assertTokenUser(payload);
  const { lesson, attachment } = await findAttachment(lessonId, attachmentId);
  await assertCanWatch(lesson, user); // the enrollment may have expired since the link was issued

  const filePath = path.join(path.dirname(mediaPaths.attachments), attachment.path);
  if (!filePath.startsWith(mediaPaths.attachments + path.sep)) throw AppError.notFound('Attachment not found');
  let body = await fs.readFile(filePath).catch(() => {
    throw AppError.notFound('Attachment not found');
  });
  const isPdf = attachment.name.toLowerCase().endsWith('.pdf') || body.subarray(0, 5).toString() === '%PDF-';
  if (isPdf) {
    try {
      body = await watermarkPdf(body, `${user.phone} - ${String(user._id).slice(-6)}`);
    } catch (err) {
      logger.warn({ err, lessonId, attachmentId }, 'PDF watermark failed, sending the original');
    }
  }
  return { body, name: attachment.name, type: isPdf ? 'application/pdf' : 'application/octet-stream' };
}
