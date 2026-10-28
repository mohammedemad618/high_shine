import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import { connectDb, disconnectDb } from '../src/db/connection.js';
import { syncIndexes } from '../src/db/indexes.js';
import { User } from '../src/models/index.js';
import { setQueueForTests } from '../src/queue/producer.js';
import { hashPassword } from '../src/utils/password.js';

export async function startDb() {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const uri = replSet.getUri('lectures_test');
  await connectDb(uri);
  await syncIndexes();
  return { replSet, uri };
}

export async function stopDb(ctx) {
  await disconnectDb();
  await ctx?.replSet.stop();
}

/** In-memory stand-in for the BullMQ queue; records what the API enqueued. */
export function useQueueStub() {
  const jobs = [];
  setQueueForTests({
    add: async (name, data, opts) => {
      jobs.push({ name, data, opts });
      return { id: opts?.jobId };
    },
    getJobs: async () => [],
    close: async () => {},
    opts: { connection: {} },
  });
  return jobs;
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });

export async function register(app, { name = 'طالب تجريبي', phone, password = 'password123', deviceId }) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ name, phone, password, deviceId, deviceName: 'Test phone', platform: 'android' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export async function login(app, { phone, password = 'password123', deviceId }) {
  return request(app).post('/api/v1/auth/login').send({ phone, password, deviceId, platform: 'web' });
}

/** Teachers and admins are not self-registered: create them directly, then log in through the API. */
export async function createStaff(app, { role, phone, name = role, deviceId = `${role}-device-0001` }) {
  await User.create({ name, phone, role, passwordHash: await hashPassword('password123'), maxDevices: 3 });
  const res = await login(app, { phone, deviceId });
  if (res.status !== 200) throw new Error(`staff login failed: ${JSON.stringify(res.body)}`);
  return res.body;
}
