import { COMPLETION_RATIO, PROGRESS_PING_SECONDS } from '@lp/shared';
import { Lesson, PlaybackSession, WatchProgress } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { assertCanWatch } from '../playback/service.js';

// Never credit more than two ping intervals per ping, so a tampered client cannot inflate watch time.
const MAX_DELTA = PROGRESS_PING_SECONDS * 2;

export async function saveProgress(lessonId, { positionSec, watchedDeltaSec }, user, deviceId) {
  const lesson = await Lesson.findById(lessonId, 'courseId isFreePreview video.durationSec');
  if (!lesson) throw AppError.notFound('Lesson not found');
  await assertCanWatch(lesson, user);

  const duration = lesson.video?.durationSec || 0;
  const position = duration ? Math.min(positionSec, duration) : positionSec;
  const reachedEnd = duration > 0 && position >= duration * COMPLETION_RATIO;

  const progress = await WatchProgress.findOneAndUpdate(
    { userId: user._id, lessonId: lesson._id },
    {
      $set: { positionSec: Math.floor(position), courseId: lesson.courseId },
      $inc: { watchedSec: Math.min(watchedDeltaSec, MAX_DELTA) },
      // completed only ever flips to true
      ...(reachedEnd ? { $max: { completed: true } } : { $setOnInsert: { completed: false } }),
    },
    { upsert: true, returnDocument: 'after' },
  );

  // The ping doubles as the playback session heartbeat.
  await PlaybackSession.updateOne({ userId: user._id, deviceId }, { $set: { lastSeenAt: new Date(), lessonId: lesson._id } });

  return { positionSec: progress.positionSec, completed: progress.completed, watchedSec: progress.watchedSec };
}
