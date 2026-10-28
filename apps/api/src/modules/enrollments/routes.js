import { Router } from 'express';
import { ROLES } from '@lp/shared';
import { authenticate } from '../../middleware/auth.js';
import { redeemLimiter } from '../../middleware/rateLimit.js';
import { requireRole } from '../../middleware/roles.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { redeemSchema } from './validation.js';

const router = Router();
const student = [authenticate, requireRole(ROLES.STUDENT)];

router.post('/enrollments/redeem', ...student, redeemLimiter, validate({ body: redeemSchema }), controller.redeem);
router.get('/me/courses', ...student, controller.myCourses);

export default router;
