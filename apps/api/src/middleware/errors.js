import { ERROR_CODES } from '@lp/shared';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export function notFound(_req, _res, next) {
  next(AppError.notFound('Route not found'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let error = err;

  if (err?.name === 'ZodError') {
    error = AppError.badRequest(ERROR_CODES.VALIDATION, 'Invalid input', err.issues);
  } else if (err?.name === 'CastError') {
    error = AppError.notFound();
  } else if (err?.code === 11000) {
    error = AppError.conflict(ERROR_CODES.CONFLICT, 'Duplicate value');
  } else if (err?.name === 'MulterError') {
    error = AppError.badRequest(ERROR_CODES.VALIDATION, err.message);
  } else if (err?.type === 'entity.parse.failed') {
    error = AppError.badRequest(ERROR_CODES.VALIDATION, 'Malformed JSON');
  }

  if (!(error instanceof AppError)) {
    (req.log || logger).error({ err }, 'Unhandled error');
    error = new AppError(500, ERROR_CODES.INTERNAL, 'Internal server error');
  }

  res.status(error.status).json({
    error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
  });
}
