import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Must run before src/config/env.js is imported.
process.env.NODE_ENV = 'test';
process.env.MEDIA_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'lp-media-'));
process.env.PUBLIC_API_URL = 'http://api.test';
process.env.MEDIA_PUBLIC_URL = 'http://media.test';
process.env.SECURE_LINK_SECRET = 'test-secure-link-secret';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.PLAYBACK_SECRET = 'test-playback-secret';
