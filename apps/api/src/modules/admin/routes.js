import { Router } from 'express';
import { ROLES } from '@lp/shared';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';
import { idParams, validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import {
  codesQuery,
  createTeacherSchema,
  generateCodesQuery,
  generateCodesSchema,
  grantEnrollmentSchema,
  listEnrollmentsQuery,
  listUsersQuery,
  updateEnrollmentSchema,
  updateUserSchema,
} from './validation.js';

const router = Router();
router.use(authenticate, requireRole(ROLES.ADMIN));

router.post('/teachers', validate({ body: createTeacherSchema }), controller.createTeacher);

router.get('/users', validate({ query: listUsersQuery }), controller.listUsers);
router.get('/users/:id', validate({ params: idParams }), controller.getUser);
router.patch('/users/:id', validate({ params: idParams, body: updateUserSchema }), controller.updateUser);
router.delete('/users/:id/devices', validate({ params: idParams }), controller.clearDevices);

router.post('/codes', validate({ query: generateCodesQuery, body: generateCodesSchema }), controller.generateCodes);
router.get('/codes', validate({ query: codesQuery }), controller.listCodes);

router.get('/enrollments', validate({ query: listEnrollmentsQuery }), controller.listEnrollments);
router.post('/enrollments', validate({ body: grantEnrollmentSchema }), controller.grantEnrollment);
router.patch('/enrollments/:id', validate({ params: idParams, body: updateEnrollmentSchema }), controller.updateEnrollment);

router.get('/stats', controller.stats);

export default router;
