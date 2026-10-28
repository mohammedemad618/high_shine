import { RENDITIONS } from '@lp/shared';

const even = (n) => Math.max(2, Math.round(n / 2) * 2);

/**
 * Picks the renditions for a source. Never upscales: a 480p source gets 360p and 480p only.
 * Sizes are measured on the short side so portrait recordings are handled too.
 * A source smaller than 360p gets a single rendition at its own size.
 */
export function buildLadder({ width, height }) {
  const shortSide = Math.min(width, height);
  const portrait = height > width;
  const picked = RENDITIONS.filter((r) => r.height <= shortSide);
  const ladder = picked.length ? picked : [{ ...RENDITIONS[0], height: even(shortSide) }];

  return ladder.map((r) => {
    const scale = r.height / shortSide;
    const outW = portrait ? even(r.height) : even(width * scale);
    const outH = portrait ? even(height * scale) : even(r.height);
    return {
      name: r.name,
      width: outW,
      height: outH,
      videoKbps: r.videoKbps,
      audioKbps: r.audioKbps,
      bandwidth: (r.videoKbps + r.audioKbps) * 1000,
    };
  });
}
