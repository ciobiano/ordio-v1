import type { StyleConfig } from '@Ordio/shared/schemas';
import {
  WAVEFORM_CENTER_Y,
  WAVEFORM_MAX_AMP,
  BAR_COUNT,
  BAR_GAP,
  MIN_BAR_HEIGHT,
  getCurrentAmplitude,
  barAmplitude,
  computeBarLayout,
  drawPillRect,
} from './constants';

export function drawPillBars(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  duration: number,
  waveformData: number[],
  style: StyleConfig
): void {
  const { width, height, waveColor } = style;
  const centerY = height * WAVEFORM_CENTER_Y;
  const maxAmp = height * WAVEFORM_MAX_AMP;
  const baseAmp = getCurrentAmplitude(currentTime, duration, waveformData);
  const { barWidth, startX } = computeBarLayout(width);

  ctx.globalAlpha = 0.9;
  ctx.fillStyle = waveColor;

  for (let i = 0; i < BAR_COUNT; i++) {
    const amp = barAmplitude(baseAmp, currentTime, i, BAR_COUNT);
    const barH = Math.max(MIN_BAR_HEIGHT, amp * maxAmp);
    const x = startX + i * (barWidth + BAR_GAP);

    drawPillRect(ctx, x, centerY - barH, barWidth, barH * 2, barWidth / 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;
}
