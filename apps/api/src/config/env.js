import path from 'node:path';
import { DEFAULT_MAX_DEVICES } from '@lp/shared';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

const isTest = process.env.NODE_ENV === 'test';
const devDefault = (value) => (isTest || process.env.NODE_ENV !== 'production' ? value : undefined);

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 4000),

  mongoUri: required('MONGO_URI', devDefault('mongodb://127.0.0.1:27017/lectures?replicaSet=rs0')),
  redisUrl: required('REDIS_URL', devDefault('redis://127.0.0.1:6379')),

  jwtSecret: required('JWT_SECRET', devDefault('dev-jwt-secret')),
  playbackSecret: required('PLAYBACK_SECRET', devDefault('dev-playback-secret')),
  secureLinkSecret: required('SECURE_LINK_SECRET', devDefault('dev-secure-link-secret')),

  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS || 30),
  defaultMaxDevices: Number(process.env.DEFAULT_MAX_DEVICES || DEFAULT_MAX_DEVICES),

  publicApiUrl: (process.env.PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, ''),
  mediaPublicUrl: (process.env.MEDIA_PUBLIC_URL || 'http://localhost:8080').replace(/\/$/, ''),
  corsOrigins: (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  mediaRoot: path.resolve(process.env.MEDIA_ROOT || '/srv/media'),
  playbackTtlSec: Number(process.env.PLAYBACK_TTL_SEC || 4 * 60 * 60),
  keepSource: (process.env.KEEP_SOURCE ?? 'true') === 'true',
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 8 * 1024 ** 3),

  // How long a playback session stays "live" without a progress ping before another device may play.
  playbackSessionIdleSec: Number(process.env.PLAYBACK_SESSION_IDLE_SEC || 60),
  // Nginx sets X-Forwarded-For; trust exactly one proxy hop.
  trustProxy: Number(process.env.TRUST_PROXY ?? 1),
};

export const mediaPaths = {
  uploads: path.join(env.mediaRoot, 'uploads'),
  hls: path.join(env.mediaRoot, 'hls'),
  thumbs: path.join(env.mediaRoot, 'thumbs'),
  attachments: path.join(env.mediaRoot, 'attachments'),
  covers: path.join(env.mediaRoot, 'covers'),
};
