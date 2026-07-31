import type { StyleConfig } from '@Ordio/shared/schemas';

// ── Layout constants ────────────────────────────────────────────────

export const WAVEFORM_CENTER_Y = 0.72;
export const WAVEFORM_CENTER_Y_FLIPPED = 1 - WAVEFORM_CENTER_Y; // 0.28
export const WAVEFORM_MAX_AMP = 0.07;
export const GAP_ABOVE_WAVEFORM = 0.05;
export const WAVEFORM_SIDE_MARGIN_PX = 2;
export const BAR_COUNT = 48;
export const BAR_GAP = 5;
export const BAR_MIN_WIDTH = 6;
export const SPOKE_COUNT = 120;
export const SPOKE_WIDTH = 3;
export const CIRCLE_CENTER_Y = 0.62;
export const CIRCLE_CENTER_Y_FLIPPED = 1 - CIRCLE_CENTER_Y; // 0.38
export const CIRCLE_INNER_RADIUS = 0.08;
export const CIRCLE_MAX_BAR_LEN = 0.12;
// Orb — wireframe sphere ported from the caption-presets design study. Every
// value below is the design's own: periods are its CSS animation durations,
// alphas its rgba() stops, and the geometry ratios come from its 176px box
// (1.5px stroke on an 88px radius; crosshair spanning 128% of the box).
// Footprint matches the circle variant so captions clear it the same way.
// Baseline bars — the cream-block panel's waveform. Not the pill bars: 60 thin
// bars growing UP from a baseline just off the bottom edge, never mirrored.
// Ratios come from the study's 360x640 frame (horizontal off width, vertical
// off height, matching how its fixed-px CSS behaves).
export const BASELINE_BAR_COUNT = 60;
export const BASELINE_SIDE_PAD_RATIO = 10 / 360;
export const BASELINE_GAP_RATIO = 2 / 360;
export const BASELINE_RADIUS_RATIO = 1 / 360;
export const BASELINE_BOTTOM_PAD_RATIO = 10 / 640;
export const BASELINE_MIN_H_RATIO = 3 / 640;
export const BASELINE_RANGE_H_RATIO = 26 / 640;

// The study's orb sits in a centered column above its phrase, which puts its
// center at ~42% rather than down in the waveform strip.
export const ORB_CENTER_Y = 0.42;
export const ORB_CENTER_Y_FLIPPED = 1 - ORB_CENTER_Y;
export const ORB_RADIUS_RATIO = CIRCLE_INNER_RADIUS + CIRCLE_MAX_BAR_LEN; // 0.20
export const ORB_STROKE_RATIO = 1.5 / 88;
export const ORB_CROSSHAIR_OVERSHOOT = 1.28;

export const ORB_SPIN_PERIOD = 42;
export const ORB_BREATHE_PERIOD = 6;
export const ORB_BREATHE_FROM = 1;
export const ORB_BREATHE_TO = 1.035;

export const ORB_RING_A_PERIOD = 9;
export const ORB_RING_A_FROM = 1;
export const ORB_RING_A_TO = 0.12;
export const ORB_RING_B_PERIOD = 13;
export const ORB_RING_B_FROM = 0.14;
export const ORB_RING_B_TO = 1;

// The tag riding top-right of the orb composition. Ratios are of canvas
// width, taken from the study's 360px-wide frame.
export const ORB_TAG_TEXT = 'ordio.ai/presets';
export const ORB_TAG_INSET_RATIO = 22 / 360;
export const ORB_TAG_FONT_RATIO = 10 / 360;
export const ORB_TAG_TRACKING_EM = 0.04;
export const ORB_TAG_ALPHA = 0.72;
export const ORB_TAG_GAP_RATIO = 6 / 360;
export const ORB_TAG_CARET_W_RATIO = 2 / 360;
export const ORB_TAG_CARET_H_RATIO = 11 / 360;
export const ORB_TAG_CARET_COLOR = '#D81E0B';
export const ORB_TAG_CARET_PERIOD = 1;

export const ORB_SHELL_ALPHA = 0.9;
export const ORB_RING_A_ALPHA = 0.55;
export const ORB_RING_B_ALPHA = 0.4;
export const ORB_CROSSHAIR_X_ALPHA = 0.32;
export const ORB_CROSSHAIR_Y_ALPHA = 0.18;

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
  const sampleIndex = Math.min(Math.floor(progress * waveformData.length), waveformData.length - 1);
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
  const availableWidth = Math.max(0, canvasWidth - WAVEFORM_SIDE_MARGIN_PX * 2 - totalGaps);
  const barWidth = Math.max(
    BAR_MIN_WIDTH,
    availableWidth / BAR_COUNT
  );
  const totalWidth = BAR_COUNT * barWidth + totalGaps;
  const startX = Math.max(WAVEFORM_SIDE_MARGIN_PX, (canvasWidth - totalWidth) / 2);
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
