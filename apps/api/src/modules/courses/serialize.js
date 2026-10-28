import { env } from '../../config/env.js';

export const publicMediaUrl = (relative) => (relative ? `${env.mediaPublicUrl}/${relative}` : null);

export function courseSummary(course) {
  const teacher = course.teacherId && course.teacherId.name ? course.teacherId : null;
  return {
    id: String(course._id),
    title: course.title,
    slug: course.slug,
    description: course.description,
    priceIqd: course.priceIqd,
    status: course.status,
    coverUrl: publicMediaUrl(course.coverPath),
    teacher: teacher ? { id: String(teacher._id), name: teacher.name } : { id: String(course.teacherId) },
    stats: {
      lessonsCount: course.stats?.lessonsCount ?? 0,
      totalDurationSec: course.stats?.totalDurationSec ?? 0,
    },
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}

export function lessonSummary(lesson, { staff = false } = {}) {
  const base = {
    id: String(lesson._id),
    sectionId: String(lesson.sectionId),
    title: lesson.title,
    order: lesson.order,
    isFreePreview: lesson.isFreePreview,
    durationSec: lesson.video?.durationSec ?? null,
    thumbUrl: lesson.video?.thumbPath ? publicMediaUrl(lesson.video.thumbPath) : null,
    attachmentsCount: lesson.attachments?.length ?? 0,
  };
  if (!staff) return base;
  return {
    ...base,
    status: lesson.status,
    processing: lesson.processing,
    video: {
      originalName: lesson.video?.originalName ?? null,
      sizeBytes: lesson.video?.sizeBytes ?? null,
      width: lesson.video?.width ?? null,
      height: lesson.video?.height ?? null,
      renditions: lesson.video?.renditions ?? [],
      hasSource: Boolean(lesson.video?.sourcePath),
    },
    attachments: (lesson.attachments || []).map((a) => ({ id: String(a._id), name: a.name, size: a.size })),
  };
}
