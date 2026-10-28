import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { idParams, validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { progressSchema } from './validation.js';

const router = Router();

router.post('/lessons/:id/progress', authenticate, validate({ params: idParams, body: progressSchema }), controller.save);

export default router;
