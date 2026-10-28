import crypto from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Signs a media URL for Nginx's secure_link module. Must match media.conf:
 *   secure_link $arg_md5,$arg_expires;
 *   secure_link_md5 "$secure_link_expires$uri <SECURE_LINK_SECRET>";
 * @param {string} uriPath path as Nginx sees it, e.g. /hls/<lessonId>/v0/seg_00001.ts
 * @param {number} expires unix seconds
 */
export function signMediaPath(uriPath, expires, secret = env.secureLinkSecret) {
  const md5 = crypto.createHash('md5').update(`${expires}${uriPath} ${secret}`).digest('base64url');
  return `${env.mediaPublicUrl}${uriPath}?md5=${md5}&expires=${expires}`;
}
