import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { loginLimiter } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { changePasswordSchema, deleteAccountSchema } from './validation.js';

const router = Router();

router.get('/me', authenticate, controller.me);
// Both check the current password, so they share the login rate limit against guessing.
router.patch('/me/password', authenticate, loginLimiter, validate({ body: changePasswordSchema }), controller.changePassword);
router.delete('/me', authenticate, loginLimiter, validate({ body: deleteAccountSchema }), controller.deleteAccount);
router.get('/app-config', controller.appConfig);

export default router;
