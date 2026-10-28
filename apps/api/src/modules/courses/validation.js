import { z } from 'zod';
import { objectId, pagination } from '../../middleware/validate.js';

const sectionInput = z.object({
  _id: objectId.optional(),
  title: z.string().trim().min(1).max(150),
});

export const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  teacherId: objectId.optional(),
  mine: z.enum(['true', 'false']).optional(),
  ...pagination,
});

export const courseParams = z.object({ id: z.string().trim().min(1).max(200) });

export const createCourseSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().max(5000).optional().default(''),
  priceIqd: z.number().int().min(0).optional().default(0),
  sections: z.array(sectionInput.omit({ _id: true })).max(100).optional(),
  // only admins may create a course on behalf of a teacher
  teacherId: objectId.optional(),
});

export const updateCourseSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  description: z.string().max(5000).optional(),
  priceIqd: z.number().int().min(0).optional(),
  // Full ordered list of sections; omitted sections are deleted (only if empty).
  sections: z.array(sectionInput).max(100).optional(),
  // Drag-and-drop result for lessons: their section and position.
  lessonOrder: z
    .array(z.object({ lessonId: objectId, sectionId: objectId, order: z.number().int().min(0) }))
    .max(1000)
    .optional(),
});

export const publishSchema = z.object({ published: z.boolean() });
