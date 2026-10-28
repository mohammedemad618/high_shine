import { ERROR_CODES, USER_STATUS } from '@lp/shared';
import { User } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { verifyAccessToken } from '../utils/tokens.js';

function bearer(req) {
  const header = req.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function loadUser(token) {
  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub);
  if (!user) throw AppError.unauthorized();
  if (user.status !== USER_STATUS.ACTIVE) throw AppError.forbidden(ERROR_CODES.ACCOUNT_SUSPENDED);
  // An admin may clear a student's devices; the old access token dies with them, not 15 minutes later.
  if (!user.devices.some((d) => d.deviceId === payload.did)) {
    throw AppError.unauthorized(ERROR_CODES.DEVICE_REVOKED);
  }
  return { user, deviceId: payload.did };
}

export async function authenticate(req, _res, next) {
  const token = bearer(req);
  if (!token) throw AppError.unauthorized();
  const { user, deviceId } = await loadUser(token);
  req.user = user;
  req.deviceId = deviceId;
  next();
}

// Attaches the user when a valid token is present, otherwise continues anonymously.
export async function optionalAuth(req, _res, next) {
  const token = bearer(req);
  if (token) {
    try {
      const { user, deviceId } = await loadUser(token);
      req.user = user;
      req.deviceId = deviceId;
    } catch {
      // public routes stay public even with a stale token
    }
  }
  next();
}
