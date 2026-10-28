import { z } from 'zod';

export const phoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^\+?\d{7,15}$/, 'Invalid phone number'));

export const passwordSchema = z.string().min(8).max(128);

const device = {
  deviceId: z.string().trim().min(8).max(128),
  deviceName: z.string().trim().max(100).optional().default(''),
  platform: z.enum(['ios', 'android', 'web', 'other']).optional().default('other'),
};

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  password: passwordSchema,
  ...device,
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(128),
  // The dashboard sends 'staff' so a student who tries it is refused before a device slot is used.
  audience: z.enum(['staff']).optional(),
  ...device,
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200),
});
