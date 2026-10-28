import fs from 'node:fs/promises';
import { createApp } from './app.js';
import { env, mediaPaths } from './config/env.js';
import { connectDb, disconnectDb } from './db/connection.js';
import { syncIndexes } from './db/indexes.js';
import { closeQueue } from './queue/producer.js';
import { logger } from './utils/logger.js';

async function main() {
  await Promise.all(Object.values(mediaPaths).map((dir) => fs.mkdir(dir, { recursive: true })));
  await connectDb();
  await syncIndexes();

  const server = createApp().listen(env.port, () => logger.info(`API listening on :${env.port}`));
  // Long tus PATCH requests (50 MB chunks on slow links) must not hit Node's default request timeout.
  server.requestTimeout = 0;
  server.headersTimeout = 65_000;

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Shutting down');
    server.close();
    await closeQueue().catch(() => {});
    await disconnectDb().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'API failed to start');
  process.exit(1);
});
