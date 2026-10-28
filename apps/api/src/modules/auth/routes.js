import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { loginLimiter, refreshLimiter, registerLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { loginSchema, refreshSchema, registerSchema } from './validation.js';

const router = Router();

router.post('/register', registerLimiter, validate({ body: registerSchema }), controller.register);
router.post('/login', loginLimiter, validate({ body: loginSchema }), controller.login);
router.post('/refresh', refreshLimiter, validate({ body: refreshSchema }), controller.refresh);
router.post('/logout', authenticate, controller.logout);

export default router;
