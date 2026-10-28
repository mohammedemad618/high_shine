import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { keyLimiter } from '../../middleware/rateLimit.js';
import { idParams, objectId, validate } from '../../middleware/validate.js';
import * as controller from './controller.js';

const router = Router();
const lessonParams = z.object({ lessonId: objectId });
const variantParams = z.object({ lessonId: objectId, variant: z.string().regex(/^v\d{1,2}$/) });

router.post('/lessons/:id/playback', authenticate, validate({ params: idParams }), controller.start);

// No JWT here: the playback token rides in the URL (?t=) because iOS does not reliably send headers for key requests.
router.get('/play/:lessonId/master.m3u8', validate({ params: lessonParams }), controller.master);
router.get('/play/:lessonId/key', keyLimiter, validate({ params: lessonParams }), controller.key);
router.get('/play/:lessonId/:variant/index.m3u8', validate({ params: variantParams }), controller.variant);

export default router;
