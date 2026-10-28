import crypto from 'node:crypto';
import { ERROR_CODES, ROLES, USER_STATUS } from '@lp/shared';
import { env } from '../../config/env.js';
import { PlaybackSession, RefreshToken, User, WatchProgress } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { revokeAllSessions } from '../auth/service.js';

// 400 rather than 401 for a wrong current password: clients treat 401 as "session expired" and sign out.
async function assertPassword(userId, password) {
  const withHash = await User.findById(userId).select('+passwordHash');
  if (!withHash || !(await verifyPassword(password, withHash.passwordHash))) {
    throw AppError.badRequest(ERROR_CODES.WRONG_PASSWORD);
  }
}

/** Changes the password and signs out every other device; the current one stays signed in. */
export async function changePassword(user, deviceId, { currentPassword, newPassword }) {
  await assertPassword(user._id, currentPassword);
  await User.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(newPassword) } });
  await Promise.all([
    RefreshToken.updateMany(
      { userId: user._id, deviceId: { $ne: deviceId }, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    ),
    PlaybackSession.deleteMany({ userId: user._id, deviceId: { $ne: deviceId } }),
  ]);
}

/**
 * Self-service account deletion (App Store 5.1.1(v), Google Play). Personal data is removed and the phone number
 * is freed for a new registration; the anonymized record stays so enrollments and code redemptions still add up.
 * Staff accounts own courses, so the administration closes those instead.
 */
export async function deleteAccount(user, { password }) {
  if (user.role !== ROLES.STUDENT) {
    throw AppError.forbidden(ERROR_CODES.FORBIDDEN, 'Staff accounts are closed by an administrator');
  }
  await assertPassword(user._id, password);
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        name: 'حساب محذوف',
        phone: `deleted-${user._id}`,
        passwordHash: await hashPassword(crypto.randomBytes(32).toString('base64url')),
        status: USER_STATUS.DELETED,
        deletedAt: new Date(),
        devices: [],
      },
    },
  );
  await Promise.all([revokeAllSessions(user._id), WatchProgress.deleteMany({ userId: user._id })]);
}

/** Public settings the apps read at start-up, so they can change without a new store release. */
export function appConfig() {
  return {
    supportWhatsapp: env.supportWhatsapp || null,
    privacyUrl: `${env.publicWebUrl}/privacy`,
    termsUrl: `${env.publicWebUrl}/terms`,
    deviceReplaceCooldownDays: env.deviceReplaceCooldownDays,
  };
}
