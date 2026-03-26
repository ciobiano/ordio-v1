import type { StyleConfig } from '@Ordio/shared/schemas';

// ── Layout constants ────────────────────────────────────────────────

export const WAVEFORM_CENTER_Y = 0.72;
export const WAVEFORM_CENTER_Y_FLIPPED = 1 - WAVEFORM_CENTER_Y; // 0.28
export const WAVEFORM_MAX_AMP = 0.07;
export const WAVEFORM_WIDTH_RATIO = 0.82;
export const BAR_COUNT = 48;
export const BAR_GAP = 5;
export const BAR_MIN_WIDTH = 6;
export const SPOKE_COUNT = 120;
export const SPOKE_WIDTH = 3;
export const CIRCLE_CENTER_Y = 0.62;
export const CIRCLE_CENTER_Y_FLIPPED = 1 - CIRCLE_CENTER_Y; // 0.38
export const CIRCLE_INNER_RADIUS = 0.08;
export const CIRCLE_MAX_BAR_LEN = 0.12;
export const MIN_AMPLITUDE = 0.04;
export const MIN_BAR_HEIGHT = 4;
export const GLOW_THRESHOLD = 0.35;

// ── Shared helpers ──────────────────────────────────────────────────

export function getCurrentAmplitude(
  currentTime: number,
  duration: number,
  waveformData: number[]
): number {
  if (waveformData.length === 0 || duration <= 0) return 0;
  const progress = currentTime / duration;
  const sampleIndex = Math.min(
    Math.floor(progress * waveformData.length),
    waveformData.length - 1
  );
  return waveformData[Math.max(0, sampleIndex)];
}

export function barAmplitude(
  baseAmp: number,
  currentTime: number,
  barIndex: number,
  barCount: number
): number {
  const center = (barCount - 1) / 2;
  const distFromCenter = Math.abs(barIndex - center) / center;
  const bellCurve = 1.0 - distFromCenter * 0.5;

  const wave1 = Math.sin(currentTime * 4.0 + barIndex * 0.25) * 0.15;
  const wave2 = Math.sin(currentTime * 2.3 + barIndex * 0.4) * 0.1;
  const wave3 = Math.sin(currentTime * 6.0 + barIndex * 0.12) * 0.05;

  return Math.max(MIN_AMPLITUDE, baseAmp * bellCurve + wave1 + wave2 + wave3);
}

export interface BarLayout {
  barWidth: number;
  startX: number;
}

export function computeBarLayout(canvasWidth: number): BarLayout {
  const totalGaps = (BAR_COUNT - 1) * BAR_GAP;
  const barWidth = Math.max(BAR_MIN_WIDTH, (canvasWidth * WAVEFORM_WIDTH_RATIO - totalGaps) / BAR_COUNT);
  const startX = (canvasWidth - (BAR_COUNT * barWidth + totalGaps)) / 2;
  return { barWidth, startX };
}

export function drawPillRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

export type WaveformDrawFn = (
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  duration: number,
  waveformData: number[],
  style: StyleConfig
) => void;
