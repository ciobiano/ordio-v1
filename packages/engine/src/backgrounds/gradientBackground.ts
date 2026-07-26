/**
 * Colorful gradient canvas backgrounds — reuses the exact gradient stops
 * already shipped for ShareCard ("Wrapped for your voice",
 * apps/web/src/lib/variants.ts:238) rather than a separate palette. Final
 * art (blob placement, grain intensity) is an intentional placeholder —
 * see docs/superpowers/specs/2026-07-25-caption-style-redesign-design.md.
 */

export type GradientVariant = 'sunset' | 'electric' | 'acid-signal';
export type GradientDecoration = 'blob' | 'grain' | 'none';

interface GradientPreset {
  angleDeg: number;
  stops: Array<[number, string]>;
}

const GRADIENT_PRESETS: Record<GradientVariant, GradientPreset> = {
  sunset: {
    angleDeg: 155,
    stops: [
      [0, '#FF8A4A'],
      [0.55, '#FF2E7E'],
      [1, '#B0165C'],
    ],
  },
  electric: {
    angleDeg: 155,
    stops: [
      [0, '#3A2BFF'],
      [0.45, '#4D7CFF'],
      [1, '#00D4FF'],
    ],
  },
  'acid-signal': {
    angleDeg: 135,
    stops: [
      [0, '#c6ff3d'],
      [1, '#6be0ff'],
    ],
  },
};

/** Converts a CSS linear-gradient angle into canvas endpoint coordinates covering the full box. */
function gradientEndpoints(angleDeg: number, width: number, height: number) {
  const angle = ((angleDeg % 360) * Math.PI) / 180;
  const length = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
  const cx = width / 2;
  const cy = height / 2;
  const dx = (Math.sin(angle) * length) / 2;
  const dy = (-Math.cos(angle) * length) / 2;
  return { x0: cx - dx, y0: cy - dy, x1: cx + dx, y1: cy + dy };
}

let cachedGrainPattern: CanvasPattern | null = null;
let cachedGrainKey: string | null = null;

/** A small tileable noise pattern, generated once and reused — real per-frame noise would be too expensive at 30fps. */
function getGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const key = 'grain-64';
  if (cachedGrainPattern && cachedGrainKey === key) return cachedGrainPattern;

  const size = 64;
  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = size;
  noiseCanvas.height = size;
  const noiseCtx = noiseCanvas.getContext('2d');
  if (!noiseCtx) return null;

  const imageData = noiseCtx.createImageData(size, size);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    imageData.data[i] = v;
    imageData.data[i + 1] = v;
    imageData.data[i + 2] = v;
    imageData.data[i + 3] = Math.random() * 40; // low alpha — subtle texture, not visible noise
  }
  noiseCtx.putImageData(imageData, 0, 0);

  const pattern = ctx.createPattern(noiseCanvas, 'repeat');
  cachedGrainPattern = pattern;
  cachedGrainKey = key;
  return pattern;
}

function drawBlobs(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const blobs = [
    { x: width * 0.15, y: height * 0.1, r: width * 0.35, color: 'rgba(255,255,255,0.35)' },
    { x: width * 0.85, y: height * 0.75, r: width * 0.3, color: 'rgba(0,0,0,0.25)' },
  ];
  ctx.save();
  ctx.filter = `blur(${Math.max(20, width * 0.08)}px)`;
  for (const blob of blobs) {
    ctx.beginPath();
    ctx.fillStyle = blob.color;
    ctx.arc(blob.x, blob.y, blob.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Fills the canvas with a gradient background + optional decoration. Draws before the waveform/caption layers, same composite order as solid/video backgrounds. */
export function drawGradientBackground(
  ctx: CanvasRenderingContext2D,
  variant: GradientVariant,
  decoration: GradientDecoration | undefined,
  width: number,
  height: number
): void {
  const preset = GRADIENT_PRESETS[variant];
  const { x0, y0, x1, y1 } = gradientEndpoints(preset.angleDeg, width, height);
  const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, color] of preset.stops) {
    gradient.addColorStop(offset, color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  if (decoration === 'blob') {
    drawBlobs(ctx, width, height);
  } else if (decoration === 'grain') {
    const pattern = getGrainPattern(ctx);
    if (pattern) {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }
}
