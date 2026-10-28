import * as models from '../models/index.js';
import { logger } from '../utils/logger.js';

// autoIndex is off in production, so indexes are built once at startup instead of on every model compile.
export async function syncIndexes() {
  for (const model of Object.values(models)) {
    await model.syncIndexes();
  }
  logger.info('MongoDB indexes in sync');
}
