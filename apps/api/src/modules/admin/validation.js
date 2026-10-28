import { z } from 'zod';
import { ENROLLMENT_STATUS, ROLES, USER_STATUS } from '@lp/shared';
import { objectId, pagination } from '../../middleware/validate.js';
import { passwordSchema, phoneSchema } from '../auth/validation.js';

export const createTeacherSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  password: passwordSchema,
});

export const listUsersQuery = z.object({
  role: z.enum(Object.values(ROLES)).optional(),
  status: z.enum(Object.values(USER_STATUS)).optional(),
  q: z.string().trim().max(80).optional(),
  ...pagination,
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  status: z.enum(Object.values(USER_STATUS)).optional(),
  maxDevices: z.number().int().min(1).max(10).optional(),
  password: passwordSchema.optional(),
});

export const generateCodesSchema = z.object({
  courseId: objectId,
  count: z.number().int().min(1).max(5000),
  batchLabel: z.string().trim().min(1).max(80),
  durationDays: z.number().int().min(1).max(3650).nullable().optional().default(null),
  maxUses: z.number().int().min(1).max(10000).optional().default(1),
  expiresAt: z.coerce.date().nullable().optional().default(null),
});

export const codesQuery = z.object({
  courseId: objectId.optional(),
  batchLabel: z.string().trim().max(80).optional(),
  format: z.enum(['json', 'csv']).optional().default('json'),
});

export const generateCodesQuery = z.object({ format: z.enum(['json', 'csv']).optional().default('json') });

export const listEnrollmentsQuery = z.object({
  courseId: objectId.optional(),
  userId: objectId.optional(),
  ...pagination,
});

export const grantEnrollmentSchema = z.object({
  userId: objectId,
  courseId: objectId,
  durationDays: z.number().int().min(1).max(3650).nullable().optional().default(null),
});

export const updateEnrollmentSchema = z.object({
  status: z.enum(Object.values(ENROLLMENT_STATUS)).optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});
