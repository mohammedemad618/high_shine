import path from 'node:path';
import { Server } from '@tus/server';
import { FileStore } from '@tus/file-store';
import { ERROR_CODES, LESSON_STATUS, ROLES, USER_STATUS } from '@lp/shared';
import { env, mediaPaths } from '../../config/env.js';
import { Course, Lesson, User } from '../../models/index.js';
import { logger } from '../../utils/logger.js';
import { verifyAccessToken } from '../../utils/tokens.js';
import { markQueued, removeSource } from '../lessons/service.js';

export const UPLOAD_PATH = '/api/v1/uploads';

// tus hooks receive a web Request and must throw { status_code, body } to reject.
const reject = (status_code, code) => {
  throw { status_code, body: JSON.stringify({ error: { code } }) };
};

async function authTeacher(req) {
  const header = req.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) reject(401, ERROR_CODES.UNAUTHORIZED);
  let payload;
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch (err) {
    reject(401, err.code || ERROR_CODES.UNAUTHORIZED);
  }
  const user = await User.findById(payload.sub);
  if (!user || user.status !== USER_STATUS.ACTIVE) reject(401, ERROR_CODES.UNAUTHORIZED);
  if (![ROLES.TEACHER, ROLES.ADMIN].includes(user.role)) reject(403, ERROR_CODES.FORBIDDEN);
  if (!user.devices.some((d) => d.deviceId === payload.did)) reject(401, ERROR_CODES.DEVICE_REVOKED);
  return user;
}

async function assertOwns(user, lesson) {
  if (!lesson) reject(404, ERROR_CODES.NOT_FOUND);
  if (user.role === ROLES.ADMIN) return;
  const course = await Course.findById(lesson.courseId, 'teacherId');
  if (!course || String(course.teacherId) !== String(user._id)) reject(403, ERROR_CODES.FORBIDDEN);
}

// A cancelled upload (tus DELETE) must not leave the lesson stuck in "uploading": go back to what it was.
async function resetCancelledUpload(uploadId) {
  const lesson = await Lesson.findOne({ 'video.uploadId': uploadId, status: LESSON_STATUS.UPLOADING });
  if (!lesson) return;
  if (lesson.video.hlsPath) lesson.status = LESSON_STATUS.READY;
  else lesson.status = lesson.video.sourcePath ? LESSON_STATUS.FAILED : LESSON_STATUS.DRAFT;
  lesson.video.uploadId = null;
  await lesson.save();
}

export function createTusServer() {
  const server = new Server({
    path: UPLOAD_PATH,
    datastore: new FileStore({ directory: mediaPaths.uploads }),
    maxSize: env.maxUploadBytes,
    respectForwardedHeaders: true,
    allowedOrigins: env.corsOrigins.length ? env.corsOrigins : undefined,

    // Every tus request (POST, HEAD, PATCH, DELETE) carries the teacher's JWT.
    async onIncomingRequest(req, uploadId) {
      const user = await authTeacher(req);
      if (req.method !== 'POST' && uploadId) {
        await assertOwns(user, await Lesson.findOne({ 'video.uploadId': uploadId }));
      }
    },

    async onUploadCreate(req, upload) {
      const user = await authTeacher(req);
      const lessonId = upload.metadata?.lessonId;
      if (!lessonId || !/^[a-f\d]{24}$/i.test(lessonId)) reject(400, ERROR_CODES.VALIDATION);
      const lesson = await Lesson.findById(lessonId);
      await assertOwns(user, lesson);
      if ([LESSON_STATUS.QUEUED, LESSON_STATUS.PROCESSING].includes(lesson.status)) {
        reject(409, ERROR_CODES.INVALID_STATE);
      }
      lesson.status = LESSON_STATUS.UPLOADING;
      lesson.video.uploadId = upload.id;
      lesson.video.originalName = upload.metadata?.filename || upload.metadata?.name || null;
      lesson.video.sizeBytes = upload.size ?? null;
      lesson.processing = { progress: 0, attempts: 0, error: null };
      await lesson.save();
      return {};
    },

    async onUploadFinish(req, upload) {
      const user = await authTeacher(req);
      // Look the lesson up by upload id rather than trusting the client's metadata a second time.
      const lesson = await Lesson.findOne({ 'video.uploadId': upload.id });
      await assertOwns(user, lesson);
      const sourcePath = path.posix.join('uploads', upload.id);
      if (lesson.video.sourcePath && lesson.video.sourcePath !== sourcePath) {
        await removeSource(lesson.video.sourcePath);
      }
      lesson.video.sourcePath = sourcePath;
      await markQueued(lesson);
      logger.info({ lessonId: String(lesson._id), uploadId: upload.id }, 'Upload finished, transcode queued');
      return {};
    },
  });
  // EVENTS.POST_TERMINATE from @tus/utils; fired after the DELETE has removed the partial file.
  server.on('POST_TERMINATE', (_req, _res, uploadId) => {
    resetCancelledUpload(uploadId).catch((err) => logger.warn({ err, uploadId }, 'Could not reset a cancelled upload'));
  });
  return server;
}

/** Express handler. Mount it before any body parser so tus can read the raw stream. */
export function tusHandler() {
  const server = createTusServer();
  return (req, res) => server.handle(req, res);
}
