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

const DAY_MS = 24 * 60 * 60 * 1000;

// The size check and the push happen in one atomic update so two parallel logins cannot exceed the limit.
async function pushDevice(userId, { deviceId, deviceName, platform }, now) {
  const added = await User.updateOne(
    {
      _id: userId,
      'devices.deviceId': { $ne: deviceId },
      $expr: { $lt: [{ $size: '$devices' }, '$maxDevices'] },
    },
    { $push: { devices: { deviceId, name: deviceName, platform, addedAt: now, lastSeenAt: now } } },
  );
  return added.modifiedCount > 0;
}

/**
 * Binds the device to the account, or refreshes lastSeenAt if it is already bound.
 * At the limit the client gets DEVICE_LIMIT with { canReplace, nextReplaceAt, replaceTarget }; it may then retry
 * with replaceDevice, which signs out the least recently used device. That self-service swap is allowed once per
 * DEVICE_REPLACE_COOLDOWN_DAYS so an account cannot rotate between many people.
 */
async function bindDevice(user, { deviceId, deviceName, platform, replaceDevice }) {
  const now = new Date();
  const touch = { 'devices.$.lastSeenAt': now };
  if (deviceName) touch['devices.$.name'] = deviceName;
  const seen = await User.updateOne({ _id: user._id, 'devices.deviceId': deviceId }, { $set: touch });
  if (seen.matchedCount) return;
  if (await pushDevice(user._id, { deviceId, deviceName, platform }, now)) return;

  const current = await User.findById(user._id, 'devices lastDeviceReplaceAt');
  const cooldownStart = new Date(now.getTime() - env.deviceReplaceCooldownDays * DAY_MS);
  const nextReplaceAt = current.lastDeviceReplaceAt > cooldownStart
    ? new Date(current.lastDeviceReplaceAt.getTime() + env.deviceReplaceCooldownDays * DAY_MS)
    : null;
  const oldest = [...current.devices].sort((a, b) => a.lastSeenAt - b.lastSeenAt)[0];

  if (!replaceDevice) {
    throw new AppError(403, ERROR_CODES.DEVICE_LIMIT, undefined, {
      canReplace: !nextReplaceAt && Boolean(oldest),
      nextReplaceAt,
      replaceTarget: oldest ? { name: oldest.name, platform: oldest.platform, lastSeenAt: oldest.lastSeenAt } : null,
    });
  }
  if (nextReplaceAt || !oldest) throw new AppError(403, ERROR_CODES.DEVICE_REPLACE_LOCKED, undefined, { nextReplaceAt });

  // Claim the swap atomically: a parallel login cannot use the same cooldown window twice.
  const swapped = await User.updateOne(
    {
      _id: user._id,
      'devices.deviceId': oldest.deviceId,
      $or: [{ lastDeviceReplaceAt: null }, { lastDeviceReplaceAt: { $lte: cooldownStart } }],
    },
    { $pull: { devices: { deviceId: oldest.deviceId } }, $set: { lastDeviceReplaceAt: now } },
  );
  if (!swapped.modifiedCount) throw AppError.forbidden(ERROR_CODES.DEVICE_LIMIT);
  await Promise.all([
    RefreshToken.updateMany({ userId: user._id, deviceId: oldest.deviceId, revokedAt: null }, { $set: { revokedAt: now } }),
    PlaybackSession.deleteMany({ userId: user._id, deviceId: oldest.deviceId }),
  ]);
  if (!(await pushDevice(user._id, { deviceId, deviceName, platform }, now))) {
    throw AppError.forbidden(ERROR_CODES.DEVICE_LIMIT);
  }
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
  if (!user || user.status === USER_STATUS.DELETED || !(await verifyPassword(input.password, user.passwordHash))) {
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
