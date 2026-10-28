import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env.js';

export const TRANSCODE_QUEUE = 'transcode';

let queue = null;

function getQueue() {
  if (!queue) {
    const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
    queue = new Queue(TRANSCODE_QUEUE, {
      connection,
      defaultJobOptions: {
        // 1 run + 2 retries, then the worker marks the lesson failed
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    });
  }
  return queue;
}

export async function enqueueTranscode(lessonId, attempt) {
  // A distinct jobId per submission so a reprocess is never deduplicated against the failed job.
  return getQueue().add('transcode', { lessonId: String(lessonId) }, { jobId: `${lessonId}-${attempt}` });
}

export async function removeTranscodeJobs(lessonId) {
  const q = getQueue();
  const jobs = await q.getJobs(['waiting', 'delayed', 'prioritized']);
  await Promise.all(jobs.filter((j) => j.data?.lessonId === String(lessonId)).map((j) => j.remove()));
}

export async function closeQueue() {
  if (queue) {
    await queue.close();
    await queue.opts.connection.quit?.();
    queue = null;
  }
}

// Tests replace the queue with an in-memory stub.
export function setQueueForTests(stub) {
  queue = stub;
}
