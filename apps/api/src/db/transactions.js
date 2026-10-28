import mongoose from 'mongoose';

/**
 * Runs `fn(session)` inside a MongoDB transaction and retries on transient errors.
 * Requires a replica set (a single-node one is enough).
 */
export async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
