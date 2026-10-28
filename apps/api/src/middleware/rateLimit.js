import { rateLimit } from 'express-rate-limit';
import { ERROR_CODES } from '@lp/shared';

// In-memory store: fine for the single API container in the plan. Nginx applies a second, coarser limit.
function limiter(windowMs, limit) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    handler: (_req, res) => {
      res.status(429).json({ error: { code: ERROR_CODES.RATE_LIMITED, message: 'Too many requests' } });
    },
  });
}

export const loginLimiter = limiter(15 * 60 * 1000, 10);
export const registerLimiter = limiter(60 * 60 * 1000, 10);
export const refreshLimiter = limiter(15 * 60 * 1000, 60);
export const keyLimiter = limiter(60 * 1000, 30);
export const redeemLimiter = limiter(60 * 60 * 1000, 20);
