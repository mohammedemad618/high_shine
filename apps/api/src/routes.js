import { Router } from 'express';
import authRoutes from './modules/auth/routes.js';
import userRoutes from './modules/users/routes.js';
import courseRoutes from './modules/courses/routes.js';
import lessonRoutes from './modules/lessons/routes.js';
import enrollmentRoutes from './modules/enrollments/routes.js';
import playbackRoutes from './modules/playback/routes.js';
import progressRoutes from './modules/progress/routes.js';
import adminRoutes from './modules/admin/routes.js';

export function apiRouter() {
  const router = Router();
  router.get('/health', (_req, res) => res.json({ ok: true }));
  router.use('/auth', authRoutes);
  router.use(userRoutes);
  router.use(courseRoutes);
  router.use(lessonRoutes);
  router.use(enrollmentRoutes);
  router.use(playbackRoutes);
  router.use(progressRoutes);
  router.use('/admin', adminRoutes);
  return router;
}
