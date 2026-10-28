import { z } from 'zod';
import { objectId } from '../../middleware/validate.js';

export const createLessonSchema = z.object({
  title: z.string().trim().min(1).max(200),
  sectionId: objectId,
  isFreePreview: z.boolean().optional().default(false),
});

export const updateLessonSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  sectionId: objectId.optional(),
  order: z.number().int().min(0).optional(),
  isFreePreview: z.boolean().optional(),
});

export const attachmentParams = z.object({ id: objectId, attachmentId: objectId });
