import { spawn } from 'node:child_process';
import { config } from '../config.js';

/**
 * Runs FFmpeg. When `durationSec` and `onProgress` are given, parses `-progress pipe:1` output
 * and reports a 0–99 percentage (100 is reported by the caller once everything is written).
 */
export function runFfmpeg(args, { durationSec, onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(config.ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'], signal });
    let stderr = '';
    let buffer = '';

    child.stdout.on('data', (chunk) => {
      if (!onProgress || !durationSec) return;
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const [key, value] = line.trim().split('=');
        if (key === 'out_time_us' || key === 'out_time_ms') {
          const seconds = Number(value) / 1e6;
          if (Number.isFinite(seconds)) onProgress(Math.min(99, Math.max(0, Math.floor((seconds / durationSec) * 100))));
        }
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString()).slice(-8000);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.trim().split('\n').slice(-5).join(' | ')}`));
    });
  });
}
