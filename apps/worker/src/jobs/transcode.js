import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { KEY_URI_PLACEHOLDER, LESSON_STATUS } from '@lp/shared';
import { config } from '../config.js';
import { collections, refreshCourseStats, toId, updateLesson } from '../db.js';
import { buildHlsArgs, buildThumbnailArgs } from '../ffmpeg/args.js';
import { buildLadder } from '../ffmpeg/ladder.js';
import { probe } from '../ffmpeg/probe.js';
import { runFfmpeg } from '../ffmpeg/run.js';

const media = (...parts) => path.join(config.mediaRoot, ...parts);

/**
 * probe → random AES-128 key → one-pass HLS encode into a temp folder → thumbnail →
 * swap the folder into place, store the key, mark the lesson ready.
 * The key is written to a private temp file only for FFmpeg's sake and deleted right after;
 * the copy that playback uses lives in MongoDB.
 */
export async function transcodeLesson(lessonId, { log = console } = {}) {
  const { lessons, mediaKeys } = collections();
  const lesson = await lessons.findOne({ _id: toId(lessonId) });
  if (!lesson) {
    log.warn({ lessonId }, 'Lesson no longer exists, skipping');
    return { skipped: true };
  }
  if (!lesson.video?.sourcePath) throw new Error('Lesson has no uploaded source');

  const input = media(lesson.video.sourcePath);
  const id = String(lesson._id);
  const finalDir = media('hls', id);
  const workDir = media('hls', `.${id}.tmp-${Date.now()}`);
  const keyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lp-key-'));

  await updateLesson(id, {
    status: LESSON_STATUS.PROCESSING,
    'processing.progress': 0,
    'processing.error': null,
    'processing.startedAt': new Date(),
    'processing.attempts': (lesson.processing?.attempts ?? 0) + 1,
  });

  try {
    const source = await probe(input);
    const ladder = buildLadder(source);

    const key = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16).toString('hex');
    const keyFile = path.join(keyDir, 'enc.key');
    const keyInfoFile = path.join(keyDir, 'enc.keyinfo');
    await fs.writeFile(keyFile, key, { mode: 0o600 });
    // line 1: URI written into the playlist (replaced per playback by the API), line 2: key path, line 3: IV
    await fs.writeFile(keyInfoFile, `${KEY_URI_PLACEHOLDER}\n${keyFile}\n${iv}\n`, { mode: 0o600 });

    await Promise.all(ladder.map((_, i) => fs.mkdir(path.join(workDir, `v${i}`), { recursive: true })));

    let lastWrite = 0;
    await runFfmpeg(buildHlsArgs({ input, outDir: workDir, ladder, hasAudio: source.hasAudio, keyInfoFile }), {
      durationSec: source.durationSec,
      onProgress: (progress) => {
        const now = Date.now();
        if (now - lastWrite < config.progressIntervalMs) return;
        lastWrite = now;
        updateLesson(id, { 'processing.progress': progress }).catch((err) => log.warn({ err }, 'progress write failed'));
      },
    });

    const thumbRel = path.posix.join('thumbs', `${id}.jpg`);
    await fs.mkdir(media('thumbs'), { recursive: true });
    await runFfmpeg(
      buildThumbnailArgs({ input, output: media(thumbRel), atSec: Math.min(10, Math.floor(source.durationSec / 2)) }),
    );

    // Swap the finished folder into place, then publish the matching key.
    await fs.rm(finalDir, { recursive: true, force: true });
    await fs.rename(workDir, finalDir);
    await mediaKeys.updateOne(
      { lessonId: lesson._id },
      { $set: { key, iv }, $setOnInsert: { lessonId: lesson._id, createdAt: new Date() } },
      { upsert: true },
    );

    const set = {
      status: LESSON_STATUS.READY,
      'video.durationSec': Math.round(source.durationSec),
      'video.width': source.width,
      'video.height': source.height,
      'video.hlsPath': path.posix.join('hls', id, 'master.m3u8'),
      'video.thumbPath': thumbRel,
      'video.renditions': ladder.map((r) => ({ name: r.name, width: r.width, height: r.height, bandwidth: r.bandwidth })),
      'processing.progress': 100,
      'processing.error': null,
      'processing.finishedAt': new Date(),
    };
    if (!config.keepSource) {
      await fs.rm(input, { force: true });
      await fs.rm(`${input}.json`, { force: true });
      set['video.sourcePath'] = null;
    }
    await updateLesson(id, set);
    await refreshCourseStats(lesson.courseId);

    return { durationSec: source.durationSec, renditions: ladder.map((r) => r.name) };
  } finally {
    await fs.rm(keyDir, { recursive: true, force: true });
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

/** Called after a failed attempt: back to queued while retries remain, failed (with the error) after the last. */
export async function recordFailure(lessonId, error, { final }) {
  await updateLesson(lessonId, {
    status: final ? LESSON_STATUS.FAILED : LESSON_STATUS.QUEUED,
    'processing.error': String(error?.message || error).slice(0, 1000),
    'processing.finishedAt': final ? new Date() : null,
  });
}
