import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { apiRouter } from './routes.js';
import { UPLOAD_PATH, tusHandler } from './modules/uploads/tus.js';
import { logger } from './utils/logger.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', env.trustProxy);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.corsOrigins.length ? env.corsOrigins : true,
      exposedHeaders: ['Location', 'Upload-Offset', 'Upload-Length', 'Tus-Resumable', 'Content-Disposition'],
    }),
  );
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url.startsWith('/api/v1/play/') } }));

  // tus reads the raw request stream, so it is mounted before express.json().
  app.all(`${UPLOAD_PATH}{/*rest}`, tusHandler());

  app.use(express.json({ limit: '1mb' }));
  app.use('/api/v1', apiRouter());
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
