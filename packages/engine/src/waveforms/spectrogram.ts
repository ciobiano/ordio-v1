import type { StyleConfig } from '@Ordio/shared/schemas';
import {
  WAVEFORM_CENTER_Y,
  WAVEFORM_MAX_AMP,
  BAR_COUNT,
  BAR_GAP,
  MIN_BAR_HEIGHT,
  GLOW_THRESHOLD,
  getCurrentAmplitude,
  barAmplitude,
  computeBarLayout,
  drawPillRect,
} from './constants';

const SPECTROGRAM_COLORS: [number, number, number][] = [
  [59, 130, 246],   // blue
  [45, 212, 191],   // cyan
  [34, 197, 94],    // green
  [234, 179, 8],    // yellow
  [249, 115, 22],   // orange
  [236, 72, 153],   // magenta
  [168, 85, 247],   // purple
];

function interpolateColor(t: number): string {
  const idx = t * (SPECTROGRAM_COLORS.length - 1);
  const low = Math.floor(idx);
  const high = Math.min(low + 1, SPECTROGRAM_COLORS.length - 1);
  const frac = idx - low;
  const r = Math.round(SPECTROGRAM_COLORS[low][0] + (SPECTROGRAM_COLORS[high][0] - SPECTROGRAM_COLORS[low][0]) * frac);
  const g = Math.round(SPECTROGRAM_COLORS[low][1] + (SPECTROGRAM_COLORS[high][1] - SPECTROGRAM_COLORS[low][1]) * frac);
  const b = Math.round(SPECTROGRAM_COLORS[low][2] + (SPECTROGRAM_COLORS[high][2] - SPECTROGRAM_COLORS[low][2]) * frac);
  return `rgb(${r},${g},${b})`;
}

export function drawSpectrogram(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  duration: number,
  waveformData: number[],
  style: StyleConfig,
  centerYFraction?: number
): void {
  const { width, height } = style;
  const centerY = height * (centerYFraction ?? WAVEFORM_CENTER_Y);
  const maxAmp = height * WAVEFORM_MAX_AMP;
  const baseAmp = getCurrentAmplitude(currentTime, duration, waveformData);
  const { barWidth, startX } = computeBarLayout(width);
  const radius = barWidth / 2;

  for (let i = 0; i < BAR_COUNT; i++) {
    const amp = barAmplitude(baseAmp, currentTime, i, BAR_COUNT);
    const barH = Math.max(MIN_BAR_HEIGHT, amp * maxAmp);
    const x = startX + i * (barWidth + BAR_GAP);
    const y = centerY - barH;
    const fullH = barH * 2;

    const color = interpolateColor(i / (BAR_COUNT - 1));
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    drawPillRect(ctx, x, y, barWidth, fullH, radius);
    ctx.fill();

    if (amp > GLOW_THRESHOLD) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      drawPillRect(ctx, x, y, barWidth, fullH, radius);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  ctx.globalAlpha = 1.0;
}
