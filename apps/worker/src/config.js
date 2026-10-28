import os from 'node:os';
import path from 'node:path';

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  mongoUri: process.env.MONGO_URI || (isProd ? undefined : 'mongodb://127.0.0.1:27017/lectures?replicaSet=rs0'),
  redisUrl: process.env.REDIS_URL || (isProd ? undefined : 'redis://127.0.0.1:6379'),
  mediaRoot: path.resolve(process.env.MEDIA_ROOT || '/srv/media'),
  keepSource: (process.env.KEEP_SOURCE ?? 'true') === 'true',
  // One transcode per 4 cores, at least one.
  concurrency: Number(process.env.TRANSCODE_CONCURRENCY || Math.max(1, Math.floor(os.cpus().length / 4))),
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  ffprobePath: process.env.FFPROBE_PATH || 'ffprobe',
  x264Preset: process.env.X264_PRESET || 'veryfast',
  // Unix nice value for FFmpeg (0 = normal priority); keeps encodes from starving the API and other sites.
  ffmpegNice: Number(process.env.FFMPEG_NICE ?? 10),
  // How often transcode progress is written to the lesson document.
  progressIntervalMs: 5000,
};

for (const key of ['mongoUri', 'redisUrl']) {
  if (!config[key]) throw new Error(`Missing ${key === 'mongoUri' ? 'MONGO_URI' : 'REDIS_URL'}`);
}
