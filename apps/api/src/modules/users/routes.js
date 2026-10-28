import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as controller from './controller.js';

const router = Router();

router.get('/me', authenticate, controller.me);

export default router;
