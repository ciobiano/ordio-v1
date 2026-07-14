import type { StyleConfig } from '@Ordio/shared/schemas';
import {
  SPOKE_COUNT,
  SPOKE_WIDTH,
  CIRCLE_CENTER_Y,
  CIRCLE_INNER_RADIUS,
  CIRCLE_MAX_BAR_LEN,
  MIN_AMPLITUDE,
  getCurrentAmplitude,
} from './constants';

export function drawCircleWaveform(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  duration: number,
  waveformData: number[],
  style: StyleConfig,
  centerYFraction?: number
): void {
  const { width, height, waveColor } = style;
  const cx = width / 2;
  const cy = height * (centerYFraction ?? CIRCLE_CENTER_Y);
  const smallerDim = Math.min(width, height);
  const innerRadius = smallerDim * CIRCLE_INNER_RADIUS;
  const maxBarLen = smallerDim * CIRCLE_MAX_BAR_LEN;
  const baseAmp = getCurrentAmplitude(currentTime, duration, waveformData);

  ctx.strokeStyle = waveColor;
  ctx.lineWidth = SPOKE_WIDTH;
  ctx.lineCap = 'round';
  ctx.globalAlpha = 0.85;

  for (let i = 0; i < SPOKE_COUNT; i++) {
    const angle = (i / SPOKE_COUNT) * Math.PI * 2 - Math.PI / 2;
    const wave1 = Math.sin(currentTime * 3.5 + i * 0.18) * 0.15;
    const wave2 = Math.sin(currentTime * 2.0 + i * 0.35) * 0.1;
    const amp = Math.max(MIN_AMPLITUDE, baseAmp + wave1 + wave2);
    const barLen = Math.max(3, amp * maxBarLen);

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * innerRadius, cy + Math.sin(angle) * innerRadius);
    ctx.lineTo(cx + Math.cos(angle) * (innerRadius + barLen), cy + Math.sin(angle) * (innerRadius + barLen));
    ctx.stroke();
  }

  // Inner circle decoration
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = waveColor;
  ctx.globalAlpha = 0.08;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
  ctx.strokeStyle = waveColor;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.15;
  ctx.stroke();
  ctx.globalAlpha = 1.0;
}
