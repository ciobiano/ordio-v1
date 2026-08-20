/**
 * Draw the PWA icons: the lime dot on the ink ground, matching app/icon.svg.
 *
 * Written out rather than rasterised by a tool because there is no rasteriser
 * to depend on — no sharp, no rsvg-convert, no ImageMagick — and adding one as
 * a build dependency to draw a circle would be the larger cost. The geometry
 * is two shapes; PNG is zlib plus a header.
 *
 * Kept as a script so the icons can be redrawn if the accent changes, instead
 * of being two binaries nobody knows how to reproduce.
 *
 *   node scripts/generate-app-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'apps', 'web', 'public');

/** --acid-bg-base and --acid-accent from globals.css. */
const INK = [0x0a, 0x0b, 0x0a];
const LIME = [0xc6, 0xff, 0x3d];

/** Matches the 7/32 corner and 8/32 radius in app/icon.svg. */
const CORNER_RATIO = 7 / 32;
const DOT_RATIO = 8 / 32;

/**
 * Coverage of a pixel by a shape, sampled on a 4x4 grid.
 *
 * Without this the circle's edge is a staircase, which at 192px is plainly
 * visible on a home screen. Sampling is cheap here because this runs once.
 */
const SAMPLES = 4;

function coverage(px, py, inside) {
  let hits = 0;
  for (let sy = 0; sy < SAMPLES; sy++) {
    for (let sx = 0; sx < SAMPLES; sx++) {
      const x = px + (sx + 0.5) / SAMPLES;
      const y = py + (sy + 0.5) / SAMPLES;
      if (inside(x, y)) hits++;
    }
  }
  return hits / (SAMPLES * SAMPLES);
}

function mix(under, over, alpha) {
  return Math.round(under * (1 - alpha) + over * alpha);
}

function draw(size) {
  const corner = size * CORNER_RATIO;
  const centre = size / 2;
  const dot = size * DOT_RATIO;

  const inSquircle = (x, y) => {
    /* A rounded rect is the rect minus four corner quarter-circles. */
    const cx = x < corner ? corner : x > size - corner ? size - corner : x;
    const cy = y < corner ? corner : y > size - corner ? size - corner : y;
    if (cx === x && cy === y) return true;
    return Math.hypot(x - cx, y - cy) <= corner;
  };
  const inDot = (x, y) => Math.hypot(x - centre, y - centre) <= dot;

  /* One RGBA row per line, each prefixed with a filter byte of 0. */
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);

  for (let y = 0; y < size; y++) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const ground = coverage(x, y, inSquircle);
      const mark = coverage(x, y, inDot);
      const i = row + 1 + x * 4;
      /* The dot sits on the ground, so it is composited over it and the
         alpha of the whole pixel is the ground's — the corners stay round
         and transparent instead of being squared off by the fill. */
      raw[i] = mix(INK[0], LIME[0], mark);
      raw[i + 1] = mix(INK[1], LIME[1], mark);
      raw[i + 2] = mix(INK[2], LIME[2], mark);
      raw[i + 3] = Math.round(ground * 255);
    }
  }
  return raw;
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(draw(size), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
for (const size of [192, 512]) {
  const file = join(OUT, `icon-${size}.png`);
  const bytes = png(size);
  writeFileSync(file, bytes);
  console.log(`icon-${size}.png  ${size}x${size}  ${(bytes.length / 1024).toFixed(1)} KB`);
}
