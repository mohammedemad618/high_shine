import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';

const exec = promisify(execFile);

/** Duration, resolution and whether the file has audio. Rotation metadata is honoured (phone recordings). */
export async function probe(file) {
  const { stdout } = await exec(
    config.ffprobePath,
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  const info = JSON.parse(stdout);
  const video = info.streams.find((s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1);
  if (!video) throw new Error('The file has no video stream');

  const rotation = Math.abs(
    Number(video.tags?.rotate ?? video.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0),
  );
  const swap = rotation === 90 || rotation === 270;
  const durationSec = Number(info.format?.duration ?? video.duration ?? 0);
  if (!durationSec) throw new Error('Could not read the video duration');

  return {
    durationSec,
    width: swap ? video.height : video.width,
    height: swap ? video.width : video.height,
    hasAudio: info.streams.some((s) => s.codec_type === 'audio'),
  };
}
