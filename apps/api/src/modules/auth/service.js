import { ERROR_CODES, ROLES, USER_STATUS } from '@lp/shared';
import { env } from '../../config/env.js';
import { PlaybackSession, RefreshToken, User } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { hashToken, newRefreshToken, signAccessToken } from '../../utils/tokens.js';

async function issueTokens(user, deviceId) {
  const refreshToken = newRefreshToken();
  await RefreshToken.create({
    userId: user._id,
    deviceId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000),
  });
  return { user: user.toPublic(), accessToken: signAccessToken(user, deviceId), refreshToken };
}

/**
 * Binds the device to the account, or refreshes lastSeenAt if it is already bound.
 * The size check and the push happen in one atomic update so two parallel logins cannot exceed the limit.
 */
async function bindDevice(user, { deviceId, deviceName, platform }) {
  const now = new Date();
  const touch = { 'devices.$.lastSeenAt': now };
  if (deviceName) touch['devices.$.name'] = deviceName;
  const seen = await User.updateOne({ _id: user._id, 'devices.deviceId': deviceId }, { $set: touch });
  if (seen.matchedCount) return;

  const added = await User.updateOne(
    {
      _id: user._id,
      'devices.deviceId': { $ne: deviceId },
      $expr: { $lt: [{ $size: '$devices' }, '$maxDevices'] },
    },
    { $push: { devices: { deviceId, name: deviceName, platform, addedAt: now, lastSeenAt: now } } },
  );
  if (!added.modifiedCount) throw AppError.forbidden(ERROR_CODES.DEVICE_LIMIT);
}

export async function register(input) {
  if (await User.exists({ phone: input.phone })) throw AppError.conflict(ERROR_CODES.PHONE_TAKEN);
  const user = await User.create({
    name: input.name,
    phone: input.phone,
    passwordHash: await hashPassword(input.password),
    role: ROLES.STUDENT,
    maxDevices: env.defaultMaxDevices,
    devices: [{ deviceId: input.deviceId, name: input.deviceName, platform: input.platform }],
  });
  return issueTokens(user, input.deviceId);
}

export async function login(input) {
  const user = await User.findOne({ phone: input.phone }).select('+passwordHash');
  // Same error for unknown phone and wrong password.
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw AppError.unauthorized(ERROR_CODES.INVALID_CREDENTIALS);
  }
  if (user.status !== USER_STATUS.ACTIVE) throw AppError.forbidden(ERROR_CODES.ACCOUNT_SUSPENDED);
  if (input.audience === 'staff' && user.role === ROLES.STUDENT) throw AppError.forbidden();

  await bindDevice(user, input);
  return issueTokens(await User.findById(user._id), input.deviceId);
}

export async function refresh({ refreshToken }) {
  const tokenHash = hashToken(refreshToken);
  // Claim the token atomically so two concurrent refreshes cannot both succeed.
  const current = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { revokedAt: new Date() } },
  );

  if (!current) {
    const known = await RefreshToken.findOne({ tokenHash });
    if (known?.revokedAt) {
      // A rotated token was replayed: assume theft and end every session on that device.
      await RefreshToken.updateMany(
        { userId: known.userId, deviceId: known.deviceId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
    }
    throw AppError.unauthorized(ERROR_CODES.REFRESH_INVALID);
  }

  const user = await User.findById(current.userId);
  if (!user) throw AppError.unauthorized(ERROR_CODES.REFRESH_INVALID);
  if (user.status !== USER_STATUS.ACTIVE) throw AppError.forbidden(ERROR_CODES.ACCOUNT_SUSPENDED);
  if (!user.devices.some((d) => d.deviceId === current.deviceId)) {
    throw AppError.unauthorized(ERROR_CODES.DEVICE_REVOKED);
  }
  return issueTokens(user, current.deviceId);
}

// Logging out ends the session but keeps the device bound, so logout/login cannot dodge the device limit.
export async function logout(user, deviceId) {
  await RefreshToken.updateMany({ userId: user._id, deviceId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  await PlaybackSession.deleteMany({ userId: user._id, deviceId });
}

export async function revokeAllSessions(userId) {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  await PlaybackSession.deleteMany({ userId });
}
