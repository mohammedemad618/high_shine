import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

export async function connectDb(uri = env.mongoUri) {
  await mongoose.connect(uri, {
    // Transactions need a replica set; fail fast instead of hanging if Mongo is down.
    serverSelectionTimeoutMS: 10_000,
    autoIndex: !env.isProduction,
  });
  logger.info('MongoDB connected');
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
