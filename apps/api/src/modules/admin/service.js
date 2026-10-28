import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { COURSE_STATUS, ENROLLMENT_SOURCE, ERROR_CODES, ROLES, USER_STATUS } from '@lp/shared';
import { withTransaction } from '../../db/transactions.js';
import { ActivationCode, Course, Enrollment, Lesson, User, WatchProgress } from '../../models/index.js';
import { AppError } from '../../utils/AppError.js';
import { hashPassword } from '../../utils/password.js';
import { revokeAllSessions } from '../auth/service.js';
import { grantEnrollment } from '../enrollments/service.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function createTeacher({ name, phone, password }) {
  if (await User.exists({ phone })) throw AppError.conflict(ERROR_CODES.PHONE_TAKEN);
  const user = await User.create({ name, phone, passwordHash: await hashPassword(password), role: ROLES.TEACHER, maxDevices: 3 });
  return { user: user.toPublic() };
}

export async function listUsers({ role, status, q, page, limit }) {
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { phone: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  return { items: items.map((u) => u.toPublic()), page, limit, total };
}

export async function getUser(id) {
  const user = await User.findById(id);
  if (!user) throw AppError.notFound('User not found');
  const enrollments = await Enrollment.find({ userId: user._id }).populate('courseId', 'title slug').sort({ createdAt: -1 });
  return {
    user: user.toPublic(),
    enrollments: enrollments.map((e) => ({
      id: String(e._id),
      course: e.courseId ? { id: String(e.courseId._id), title: e.courseId.title } : null,
      status: e.status,
      source: e.source,
      startsAt: e.startsAt,
      expiresAt: e.expiresAt,
    })),
  };
}

export async function updateUser(id, input, admin) {
  const user = await User.findById(id);
  if (!user) throw AppError.notFound('User not found');
  if (String(user._id) === String(admin._id) && input.status === USER_STATUS.SUSPENDED) {
    throw AppError.badRequest(ERROR_CODES.INVALID_STATE, 'You cannot suspend yourself');
  }
  if (input.name) user.name = input.name;
  if (input.maxDevices) user.maxDevices = input.maxDevices;
  if (input.status) user.status = input.status;
  if (input.password) user.passwordHash = await hashPassword(input.password);
  await user.save();
  if (input.status === USER_STATUS.SUSPENDED || input.password) await revokeAllSessions(user._id);
  return { user: user.toPublic() };
}

/** For a student who changed phones: unbind every device and end every session. */
export async function clearDevices(id) {
  const user = await User.findByIdAndUpdate(id, { $set: { devices: [] } }, { returnDocument: 'after' });
  if (!user) throw AppError.notFound('User not found');
  await revokeAllSessions(user._id);
  return { user: user.toPublic() };
}

// 32 symbols without 0/O/1/I so codes are easy to read aloud.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode() {
  const bytes = crypto.randomBytes(12);
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return chars.match(/.{4}/g).join('-');
}

export async function generateCodes(input, admin) {
  const course = await Course.findById(input.courseId, 'title');
  if (!course) throw AppError.notFound('Course not found');

  const codes = new Set();
  while (codes.size < input.count) codes.add(randomCode());
  const docs = [...codes].map((code) => ({
    code,
    courseId: course._id,
    batchLabel: input.batchLabel,
    durationDays: input.durationDays,
    maxUses: input.maxUses,
    expiresAt: input.expiresAt,
    createdBy: admin._id,
  }));
  // 60 bits of randomness per code; a collision with an older code fails the insert and the admin retries.
  const inserted = await ActivationCode.insertMany(docs, { ordered: true });
  return { course, codes: inserted };
}

export async function listCodeBatches({ courseId }) {
  const match = courseId ? { courseId: new mongoose.Types.ObjectId(courseId) } : {};
  const batches = await ActivationCode.aggregate([
    { $match: match },
    {
      $group: {
        _id: { courseId: '$courseId', batchLabel: '$batchLabel' },
        total: { $sum: 1 },
        used: { $sum: { $cond: [{ $gt: ['$usedCount', 0] }, 1, 0] } },
        durationDays: { $first: '$durationDays' },
        createdAt: { $min: '$createdAt' },
      },
    },
    { $sort: { createdAt: -1 } },
  ]);
  const courses = await Course.find({ _id: { $in: batches.map((b) => b._id.courseId) } }, 'title');
  const titles = new Map(courses.map((c) => [String(c._id), c.title]));
  return {
    items: batches.map((b) => ({
      courseId: String(b._id.courseId),
      courseTitle: titles.get(String(b._id.courseId)) ?? '',
      batchLabel: b._id.batchLabel,
      total: b.total,
      used: b.used,
      durationDays: b.durationDays,
      createdAt: b.createdAt,
    })),
  };
}

export async function findCodes({ courseId, batchLabel }) {
  const filter = {};
  if (courseId) filter.courseId = courseId;
  if (batchLabel) filter.batchLabel = batchLabel;
  const codes = await ActivationCode.find(filter).sort({ createdAt: 1 }).limit(50_000).populate('courseId', 'title');
  return codes;
}

const csvCell = (value) => {
  const s = value === null || value === undefined ? '' : value instanceof Date ? value.toISOString() : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function codesToCsv(codes, courseTitle) {
  const header = ['code', 'course', 'batch', 'durationDays', 'maxUses', 'usedCount', 'expiresAt'];
  const rows = codes.map((c) =>
    [c.code, courseTitle ?? c.courseId?.title ?? '', c.batchLabel, c.durationDays, c.maxUses, c.usedCount, c.expiresAt]
      .map(csvCell)
      .join(','),
  );
  // BOM so Excel opens Arabic text correctly.
  return `﻿${[header.join(','), ...rows].join('\n')}\n`;
}

export async function listEnrollments({ courseId, userId, page, limit }) {
  const filter = {};
  if (courseId) filter.courseId = courseId;
  if (userId) filter.userId = userId;
  const [items, total] = await Promise.all([
    Enrollment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('userId', 'name phone')
      .populate('courseId', 'title'),
    Enrollment.countDocuments(filter),
  ]);
  return {
    items: items.map((e) => ({
      id: String(e._id),
      user: e.userId ? { id: String(e.userId._id), name: e.userId.name, phone: e.userId.phone } : null,
      course: e.courseId ? { id: String(e.courseId._id), title: e.courseId.title } : null,
      status: e.status,
      source: e.source,
      startsAt: e.startsAt,
      expiresAt: e.expiresAt,
      createdAt: e.createdAt,
    })),
    page,
    limit,
    total,
  };
}

export async function grantManually({ userId, courseId, durationDays }) {
  const [user, course] = await Promise.all([User.findById(userId), Course.findById(courseId)]);
  if (!user || user.role !== ROLES.STUDENT) throw AppError.badRequest(ERROR_CODES.VALIDATION, 'userId is not a student');
  if (!course) throw AppError.notFound('Course not found');
  const enrollment = await withTransaction((session) =>
    grantEnrollment({ userId, courseId, durationDays, source: ENROLLMENT_SOURCE.ADMIN }, session),
  );
  return { enrollment: { id: String(enrollment._id), expiresAt: enrollment.expiresAt, status: enrollment.status } };
}

export async function updateEnrollment(id, input) {
  const enrollment = await Enrollment.findById(id);
  if (!enrollment) throw AppError.notFound('Enrollment not found');
  if (input.status) enrollment.status = input.status;
  if (input.expiresAt !== undefined) enrollment.expiresAt = input.expiresAt;
  await enrollment.save();
  return { enrollment: { id: String(enrollment._id), status: enrollment.status, expiresAt: enrollment.expiresAt } };
}

export async function platformStats() {
  const now = new Date();
  const [students, teachers, courses, publishedCourses, lessons, activeEnrollments, watch, codes] = await Promise.all([
    User.countDocuments({ role: ROLES.STUDENT }),
    User.countDocuments({ role: ROLES.TEACHER }),
    Course.countDocuments(),
    Course.countDocuments({ status: COURSE_STATUS.PUBLISHED }),
    Lesson.countDocuments(),
    Enrollment.countDocuments(Enrollment.activeFilter(now)),
    WatchProgress.aggregate([{ $group: { _id: null, sec: { $sum: '$watchedSec' } } }]),
    ActivationCode.aggregate([{ $group: { _id: null, total: { $sum: 1 }, redeemed: { $sum: '$usedCount' } } }]),
  ]);
  return {
    students,
    teachers,
    courses,
    publishedCourses,
    lessons,
    activeEnrollments,
    watchHours: Math.round(((watch[0]?.sec ?? 0) / 3600) * 10) / 10,
    codes: { total: codes[0]?.total ?? 0, redeemed: codes[0]?.redeemed ?? 0 },
  };
}
