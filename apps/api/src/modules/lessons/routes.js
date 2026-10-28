import { Router } from 'express';
import { ROLES } from '@lp/shared';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/roles.js';
import { fileUpload } from '../../middleware/upload.js';
import { idParams, validate } from '../../middleware/validate.js';
import * as controller from './controller.js';
import { attachmentDir } from './service.js';
import { attachmentParams, createLessonSchema, updateLessonSchema } from './validation.js';

const router = Router();
const staff = [authenticate, requireRole(ROLES.TEACHER, ROLES.ADMIN)];

const pdfUpload = fileUpload({
  dirFor: (req) => attachmentDir(req.valid.params.id),
  maxBytes: 50 * 1024 * 1024,
  mimeTypes: ['application/pdf'],
});

router.post('/courses/:id/lessons', ...staff, validate({ params: idParams, body: createLessonSchema }), controller.create);
router.get('/lessons/:id', ...staff, validate({ params: idParams }), controller.get);
router.patch('/lessons/:id', ...staff, validate({ params: idParams, body: updateLessonSchema }), controller.update);
router.delete('/lessons/:id', ...staff, validate({ params: idParams }), controller.remove);
router.get('/lessons/:id/status', ...staff, validate({ params: idParams }), controller.status);
router.post('/lessons/:id/reprocess', ...staff, validate({ params: idParams }), controller.reprocess);
router.post('/lessons/:id/attachments', ...staff, validate({ params: idParams }), pdfUpload, controller.addAttachment);
router.delete(
  '/lessons/:id/attachments/:attachmentId',
  ...staff,
  validate({ params: attachmentParams }),
  controller.removeAttachment,
);

export default router;
