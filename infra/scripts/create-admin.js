#!/usr/bin/env node
// Creates the first admin account (or promotes an existing phone number to admin).
//
// On the server:
//   cd infra && docker compose run --rm -v ./scripts:/app/apps/api/scripts:ro api \
//     node scripts/create-admin.js --name "مدير المنصة" --phone 07700000000 --password 'a-long-password'
// Locally (MONGO_URI from the environment):
//   node infra/scripts/create-admin.js --name Admin --phone 07700000000 --password secret123
import crypto from 'node:crypto';
import { parseArgs } from 'node:util';
import { promisify } from 'node:util';
import { MongoClient } from 'mongodb';

const scrypt = promisify(crypto.scrypt);

// Same format as apps/api/src/utils/password.js: scrypt$N$r$p$salt$hash
async function hashPassword(password) {
  const params = { N: 16384, r: 8, p: 1 };
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64, params);
  return ['scrypt', params.N, params.r, params.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

const { values } = parseArgs({
  options: { name: { type: 'string' }, phone: { type: 'string' }, password: { type: 'string' } },
});
const { name, phone, password } = values;
if (!name || !phone || !password || password.length < 8) {
  console.error('Usage: create-admin.js --name <name> --phone <phone> --password <min 8 chars>');
  process.exit(1);
}
const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI is not set');
  process.exit(1);
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const users = client.db().collection('users');
  const normalizedPhone = phone.replace(/[\s-]/g, '');
  const now = new Date();
  const result = await users.updateOne(
    { phone: normalizedPhone },
    {
      $set: { name, role: 'admin', status: 'active', passwordHash: await hashPassword(password), updatedAt: now },
      $setOnInsert: { phone: normalizedPhone, maxDevices: 3, devices: [], createdAt: now },
    },
    { upsert: true },
  );
  console.log(result.upsertedCount ? `Admin created: ${normalizedPhone}` : `Existing user promoted to admin: ${normalizedPhone}`);
} finally {
  await client.close();
}
