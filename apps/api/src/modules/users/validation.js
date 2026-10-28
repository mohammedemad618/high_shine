import { z } from 'zod';
import { passwordSchema } from '../auth/validation.js';

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
});
