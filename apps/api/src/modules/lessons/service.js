import fs from 'node:fs/promises';
import path from 'node:path';
import { ERROR_CODES, LESSON_STATUS } from '@lp/shared';
import { mediaPaths } from '../../config/env.js';
import { assertCourseOwner } from '../../middleware/roles.js';
import { Course, Lesson, MediaKey, PlaybackSession, WatchProgress } from '../../models/index.js';
import { enqueueTranscode, removeTranscodeJobs } from '../../queue/producer.js';
import { AppError } from '../../utils/AppError.js';
import { removeMedia } from '../../utils/files.js';
import { lessonSummary } from '../courses/serialize.js';
import { getOwnedCourse, refreshCourseStats } from '../courses/service.js';

export async function getOwnedLesson(id, user) {
  const lesson = await Lesson.findById(id);
  if (!lesson) throw AppError.notFound('Lesson not found');
  const course = await Course.findById(lesson.courseId);
  assertCourseOwner(course, user);
  return { lesson, course };
}

const view = (lesson) => ({ lesson: lessonSummary(lesson, { staff: true }) });

export async function createLesson(courseId, input, user) {
  const course = await getOwnedCourse(courseId, user);
  if (!course.sections.some((s) => String(s._id) === input.sectionId)) {
    throw AppError.badRequest(ERROR_CODES.VALIDATION, 'Unknown section id');
  }
  const last = await Lesson.findOne({ courseId: course._id, sectionId: input.sectionId }).sort({ order: -1 });
  const lesson = await Lesson.create({
    courseId: course._id,
    sectionId: input.sectionId,
    title: input.title,
    isFreePreview: input.isFreePreview,
    order: last ? last.order + 1 : 0,
  });
  return view(lesson);
}

export async function getLesson(id, user) {
  const { lesson } = await getOwnedLesson(id, user);
  return view(lesson);
}

export async function updateLesson(id, input, user) {
  const { lesson, course } = await getOwnedLesson(id, user);
  if (input.sectionId && !course.sections.some((s) => String(s._id) === input.sectionId)) {
    throw AppError.badRequest(ERROR_CODES.VALIDATION, 'Unknown section id');
  }
  for (const field of ['title', 'sectionId', 'order', 'isFreePreview']) {
    if (input[field] !== undefined) lesson[field] = input[field];
  }
  await lesson.save();
  return view(lesson);
}

export async function deleteLesson(id, user) {
  const { lesson } = await getOwnedLesson(id, user);
  if (lesson.status === LESSON_STATUS.PROCESSING) {
    throw AppError.conflict(ERROR_CODES.INVALID_STATE, 'Wait for processing to finish before deleting');
  }
  await removeTranscodeJobs(lesson._id).catch(() => {});
  await Promise.all([
    removeMedia(path.posix.join('hls', String(lesson._id))),
    removeMedia(lesson.video?.thumbPath),
    removeMedia(path.posix.join('attachments', String(lesson._id))),
    removeSource(lesson.video?.sourcePath),
    MediaKey.deleteOne({ lessonId: lesson._id }),
    WatchProgress.deleteMany({ lessonId: lesson._id }),
    PlaybackSession.deleteMany({ lessonId: lesson._id }),
  ]);
  await lesson.deleteOne();
  await refreshCourseStats(lesson.courseId);
}

// tus keeps a <id>.json metadata file next to every upload.
export async function removeSource(sourcePath) {
  if (!sourcePath) return;
  await removeMedia(sourcePath);
  await removeMedia(`${sourcePath}.json`);
}

export async function lessonStatus(id, user) {
  const { lesson } = await getOwnedLesson(id, user);
  return { id: String(lesson._id), status: lesson.status, processing: lesson.processing };
}

export async function reprocess(id, user) {
  const { lesson } = await getOwnedLesson(id, user);
  if (![LESSON_STATUS.FAILED, LESSON_STATUS.READY].includes(lesson.status)) {
    throw AppError.conflict(ERROR_CODES.INVALID_STATE, `Cannot reprocess a lesson in state ${lesson.status}`);
  }
  if (!lesson.video?.sourcePath) {
    throw AppError.conflict(ERROR_CODES.INVALID_STATE, 'The original file was deleted; upload the video again');
  }
  await markQueued(lesson);
  return view(lesson);
}

/** Moves a lesson to queued and adds the transcode job. Used after an upload finishes and on reprocess. */
export async function markQueued(lesson) {
  lesson.status = LESSON_STATUS.QUEUED;
  lesson.processing = { progress: 0, attempts: lesson.processing?.attempts ?? 0, error: null };
  await lesson.save();
  await enqueueTranscode(lesson._id, Date.now());
}

export async function addAttachment(id, file, user) {
  try {
    const { lesson } = await getOwnedLesson(id, user);
    if (!file) throw AppError.badRequest(ERROR_CODES.VALIDATION, 'file is required');
    lesson.attachments.push({
      name: file.originalname,
      path: path.posix.join('attachments', String(lesson._id), file.filename),
      size: file.size,
    });
    await lesson.save();
    return view(lesson);
  } catch (err) {
    if (file) await fs.rm(file.path, { force: true });
    throw err;
  }
}

export async function removeAttachment(id, attachmentId, user) {
  const { lesson } = await getOwnedLesson(id, user);
  const attachment = lesson.attachments.id(attachmentId);
  if (!attachment) throw AppError.notFound('Attachment not found');
  await removeMedia(attachment.path);
  attachment.deleteOne();
  await lesson.save();
  return view(lesson);
}

export const attachmentDir = (lessonId) => path.join(mediaPaths.attachments, String(lessonId));
