import { Router } from 'express';
import { ROLES } from '@lp/shared';
import { mediaPaths } from '../../config/env.js';
import { authenticate, optionalAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';
import { fileUpload } from '../../middleware/upload.js';
import { idParams, validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { courseParams, createCourseSchema, listQuery, publishSchema, updateCourseSchema } from './validation.js';

const router = Router();
const staff = [authenticate, requireRole(ROLES.TEACHER, ROLES.ADMIN)];

const coverUpload = fileUpload({
  dirFor: () => mediaPaths.covers,
  maxBytes: 5 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
});

router.get('/courses', optionalAuth, validate({ query: listQuery }), controller.list);
router.get('/courses/:id', optionalAuth, validate({ params: courseParams }), controller.get);
router.post('/courses', ...staff, validate({ body: createCourseSchema }), controller.create);
router.patch('/courses/:id', ...staff, validate({ params: idParams, body: updateCourseSchema }), controller.update);
router.post('/courses/:id/publish', ...staff, validate({ params: idParams, body: publishSchema }), controller.publish);
router.post('/courses/:id/cover', ...staff, validate({ params: idParams }), coverUpload, controller.cover);
router.get('/courses/:id/stats', ...staff, validate({ params: idParams }), controller.stats);

export default router;
