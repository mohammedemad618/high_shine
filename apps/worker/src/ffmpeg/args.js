import path from 'node:path';
import { HLS_SEGMENT_SECONDS, KEYFRAME_SECONDS } from '@lp/shared';
import { config } from '../config.js';

/**
 * One FFmpeg pass that encodes every rendition and writes AES-128 encrypted HLS:
 *   outDir/master.m3u8, outDir/v0/index.m3u8, outDir/v0/seg_00000.ts, ...
 * Keyframes every 2 s and 6 s segments let the player switch quality cleanly.
 */
export function buildHlsArgs({ input, outDir, ladder, hasAudio, keyInfoFile }) {
  const n = ladder.length;
  const split = `[0:v]split=${n}${ladder.map((_, i) => `[s${i}]`).join('')}`;
  const scales = ladder.map((r, i) => `[s${i}]scale=${r.width}:${r.height}:flags=bicubic,setsar=1[v${i}]`);

  const args = ['-hide_banner', '-nostats', '-y', '-i', input, '-filter_complex', [split, ...scales].join(';')];

  ladder.forEach((r, i) => {
    args.push('-map', `[v${i}]`);
    args.push(
      `-c:v:${i}`, 'libx264',
      `-preset:v:${i}`, config.x264Preset,
      `-profile:v:${i}`, 'main',
      `-b:v:${i}`, `${r.videoKbps}k`,
      `-maxrate:v:${i}`, `${Math.round(r.videoKbps * 1.07)}k`,
      `-bufsize:v:${i}`, `${Math.round(r.videoKbps * 1.5)}k`,
    );
  });
  if (hasAudio) {
    ladder.forEach((r, i) => {
      args.push('-map', '0:a:0', `-c:a:${i}`, 'aac', `-b:a:${i}`, `${r.audioKbps}k`, `-ac:a:${i}`, '2');
    });
  }

  const streamMap = ladder.map((_, i) => (hasAudio ? `v:${i},a:${i}` : `v:${i}`)).join(' ');
  args.push(
    '-pix_fmt', 'yuv420p',
    '-force_key_frames', `expr:gte(t,n_forced*${KEYFRAME_SECONDS})`,
    '-sc_threshold', '0',
    '-f', 'hls',
    '-hls_time', String(HLS_SEGMENT_SECONDS),
    '-hls_playlist_type', 'vod',
    '-hls_flags', 'independent_segments',
    '-hls_segment_type', 'mpegts',
    '-hls_key_info_file', keyInfoFile,
    '-hls_segment_filename', path.join(outDir, 'v%v', 'seg_%05d.ts'),
    '-master_pl_name', 'master.m3u8',
    '-var_stream_map', streamMap,
    '-progress', 'pipe:1',
    path.join(outDir, 'v%v', 'index.m3u8'),
  );
  return args;
}

export function buildThumbnailArgs({ input, output, atSec }) {
  return ['-hide_banner', '-y', '-ss', String(atSec), '-i', input, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '3', output];
}
