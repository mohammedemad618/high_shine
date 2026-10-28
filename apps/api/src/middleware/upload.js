import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { ERROR_CODES } from '@lp/shared';
import { AppError } from '../utils/AppError.js';

/**
 * Small multipart uploads (course covers, lesson PDFs). Videos never go through here — they use tus.
 * @param {(req) => string} dirFor absolute destination directory for this request
 */
export function fileUpload({ dirFor, maxBytes, mimeTypes, field = 'file' }) {
  const storage = multer.diskStorage({
    destination(req, _file, cb) {
      const dir = dirFor(req);
      fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
    },
    filename(_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter(_req, file, cb) {
      if (!mimeTypes.includes(file.mimetype)) {
        return cb(AppError.badRequest(ERROR_CODES.VALIDATION, `File type ${file.mimetype} is not allowed`));
      }
      // multer decodes the original name as latin1; restore UTF-8 so Arabic file names survive.
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
      cb(null, true);
    },
  }).single(field);
}
