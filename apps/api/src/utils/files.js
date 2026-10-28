import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

// Resolves a path stored in Mongo (relative to MEDIA_ROOT) and refuses anything that escapes it.
export function mediaPath(relative) {
  const full = path.resolve(env.mediaRoot, relative);
  if (full !== env.mediaRoot && !full.startsWith(env.mediaRoot + path.sep)) {
    throw new Error(`Path escapes media root: ${relative}`);
  }
  return full;
}

export async function removeMedia(relative) {
  if (!relative) return;
  await fs.rm(mediaPath(relative), { recursive: true, force: true });
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}
