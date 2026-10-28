import fs from 'node:fs/promises';
import path from 'node:path';
import { KEY_URI_PLACEHOLDER } from '@lp/shared';
import { mediaPaths } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { signMediaPath } from '../../utils/secureLink.js';

async function readPlaylist(lessonId, ...parts) {
  try {
    return await fs.readFile(path.join(mediaPaths.hls, String(lessonId), ...parts), 'utf8');
  } catch {
    throw AppError.notFound('Playlist not found');
  }
}

const isUriLine = (line) => line.trim() && !line.startsWith('#');

/** Master playlist: variant URIs stay relative but carry the playback token. */
export async function masterPlaylist(lessonId, token) {
  const text = await readPlaylist(lessonId, 'master.m3u8');
  return text
    .split('\n')
    .map((line) => (isUriLine(line) ? `${line.trim()}?t=${encodeURIComponent(token)}` : line))
    .join('\n');
}

/**
 * Variant playlist: the key placeholder becomes this API's key URL (with the token), and each segment
 * becomes an absolute Nginx URL signed until the token expires.
 */
export async function variantPlaylist({ lessonId, variant, token, expires, keyUrl }) {
  const text = await readPlaylist(lessonId, variant, 'index.m3u8');
  return text
    .split('\n')
    .map((line) => {
      if (line.startsWith('#EXT-X-KEY')) {
        return line.replace(`URI="${KEY_URI_PLACEHOLDER}"`, `URI="${keyUrl}?t=${encodeURIComponent(token)}"`);
      }
      if (isUriLine(line)) {
        const segment = path.posix.basename(line.trim());
        return signMediaPath(`/hls/${lessonId}/${variant}/${segment}`, expires);
      }
      return line;
    })
    .join('\n');
}
