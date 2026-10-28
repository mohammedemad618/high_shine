import fs from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import pino from 'pino';
import { config } from './config.js';
import { close, connect } from './db.js';
import { recordFailure, transcodeLesson } from './jobs/transcode.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
export const TRANSCODE_QUEUE = 'transcode';

async function main() {
  await fs.mkdir(path.join(config.mediaRoot, 'hls'), { recursive: true });
  await connect(config.mongoUri);
  log.info('MongoDB connected');

  const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const worker = new Worker(
    TRANSCODE_QUEUE,
    async (job) => {
      log.info({ jobId: job.id, lessonId: job.data.lessonId, attempt: job.attemptsMade + 1 }, 'Transcode started');
      const result = await transcodeLesson(job.data.lessonId, { log });
      log.info({ jobId: job.id, ...result }, 'Transcode finished');
      return result;
    },
    {
      connection,
      concurrency: config.concurrency,
      // A one-hour lecture takes a while; keep the lock alive and don't treat the job as stalled.
      lockDuration: 5 * 60 * 1000,
      maxStalledCount: 2,
    },
  );

  worker.on('failed', (job, err) => {
    if (!job) return;
    const final = job.attemptsMade >= (job.opts.attempts ?? 1);
    log.error({ jobId: job.id, lessonId: job.data.lessonId, attempt: job.attemptsMade, final, err: err?.message }, 'Transcode failed');
    recordFailure(job.data.lessonId, err, { final }).catch((e) => log.error({ err: e }, 'Could not record failure'));
  });
  worker.on('error', (err) => log.error({ err }, 'Worker error'));
  log.info({ concurrency: config.concurrency }, 'Transcode worker ready');

  const shutdown = async (signal) => {
    log.info({ signal }, 'Shutting down; waiting for the running job to finish');
    await worker.close();
    await connection.quit();
    await close();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  log.fatal({ err }, 'Worker failed to start');
  process.exit(1);
});
