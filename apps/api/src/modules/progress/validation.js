import { z } from 'zod';

export const progressSchema = z.object({
  positionSec: z.number().min(0).max(24 * 3600),
  // Seconds actually played since the last ping (the client sends ~15). Capped server-side.
  watchedDeltaSec: z.number().min(0).max(600).optional().default(0),
});
