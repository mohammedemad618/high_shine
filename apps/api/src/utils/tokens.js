import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ERROR_CODES } from '@lp/shared';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

export function signAccessToken(user, deviceId) {
  return jwt.sign({ role: user.role, did: deviceId }, env.jwtSecret, {
    subject: String(user._id),
    expiresIn: env.accessTokenTtl,
    audience: 'access',
  });
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret, { audience: 'access' });
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw AppError.unauthorized(ERROR_CODES.TOKEN_EXPIRED);
    throw AppError.unauthorized();
  }
}

export function newRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Playback tokens travel inside URLs (iOS AVPlayer does not reliably send headers for key requests),
// so they are scoped to one student, one lesson and one device and live only as long as PLAYBACK_TTL_SEC.
export function signPlaybackToken({ userId, lessonId, deviceId, sessionId }) {
  const exp = Math.floor(Date.now() / 1000) + env.playbackTtlSec;
  const token = jwt.sign(
    { lid: String(lessonId), did: deviceId, sid: String(sessionId), exp },
    env.playbackSecret,
    { subject: String(userId), audience: 'play' },
  );
  return { token, exp };
}

// Attachment links are opened in the system browser, so they also carry their token in the URL; minutes, not hours.
export function signFileToken({ userId, lessonId, attachmentId, deviceId }) {
  const exp = Math.floor(Date.now() / 1000) + env.attachmentLinkTtlSec;
  const token = jwt.sign(
    { lid: String(lessonId), aid: String(attachmentId), did: deviceId, exp },
    env.playbackSecret,
    { subject: String(userId), audience: 'file' },
  );
  return { token, exp };
}

export function verifyFileToken(token, lessonId, attachmentId) {
  let payload;
  try {
    payload = jwt.verify(token || '', env.playbackSecret, { audience: 'file' });
  } catch {
    throw AppError.unauthorized(ERROR_CODES.PLAYBACK_TOKEN_INVALID);
  }
  if (payload.lid !== String(lessonId) || payload.aid !== String(attachmentId)) {
    throw AppError.forbidden(ERROR_CODES.PLAYBACK_TOKEN_INVALID);
  }
  return payload;
}

export function verifyPlaybackToken(token, lessonId) {
  let payload;
  try {
    payload = jwt.verify(token || '', env.playbackSecret, { audience: 'play' });
  } catch {
    throw AppError.unauthorized(ERROR_CODES.PLAYBACK_TOKEN_INVALID);
  }
  if (payload.lid !== String(lessonId)) throw AppError.forbidden(ERROR_CODES.PLAYBACK_TOKEN_INVALID);
  return payload;
}
