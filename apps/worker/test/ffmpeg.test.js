import { describe, expect, it } from 'vitest';
import { buildHlsArgs } from '../src/ffmpeg/args.js';
import { buildLadder } from '../src/ffmpeg/ladder.js';

describe('buildLadder', () => {
  it('produces all three renditions for a 1080p source', () => {
    const ladder = buildLadder({ width: 1920, height: 1080 });
    expect(ladder.map((r) => `${r.width}x${r.height}`)).toEqual(['640x360', '854x480', '1280x720']);
    expect(ladder.map((r) => r.bandwidth)).toEqual([464000, 796000, 1296000]);
  });

  it('never upscales', () => {
    expect(buildLadder({ width: 854, height: 480 }).map((r) => r.name)).toEqual(['360p', '480p']);
    expect(buildLadder({ width: 640, height: 360 }).map((r) => r.name)).toEqual(['360p']);
  });

  it('keeps a single rendition at source size for tiny sources', () => {
    const [only] = buildLadder({ width: 426, height: 240 });
    expect(only).toMatchObject({ height: 240, width: 426 });
  });

  it('handles portrait phone recordings by their short side', () => {
    const ladder = buildLadder({ width: 720, height: 1280 });
    expect(ladder.map((r) => `${r.width}x${r.height}`)).toEqual(['360x640', '480x854', '720x1280']);
  });
});

describe('buildHlsArgs', () => {
  const base = { input: 'in.mp4', outDir: 'out', keyInfoFile: 'k.info', ladder: buildLadder({ width: 1280, height: 720 }) };

  it('maps one audio track per rendition when the source has audio', () => {
    const args = buildHlsArgs({ ...base, hasAudio: true });
    expect(args[args.indexOf('-var_stream_map') + 1]).toBe('v:0,a:0 v:1,a:1 v:2,a:2');
    expect(args).toContain('-hls_key_info_file');
    expect(args[args.indexOf('-hls_time') + 1]).toBe('6');
    expect(args[args.indexOf('-force_key_frames') + 1]).toBe('expr:gte(t,n_forced*2)');
  });

  it('omits audio mapping for silent sources', () => {
    const args = buildHlsArgs({ ...base, hasAudio: false });
    expect(args[args.indexOf('-var_stream_map') + 1]).toBe('v:0 v:1 v:2');
    expect(args).not.toContain('0:a:0');
  });
});
