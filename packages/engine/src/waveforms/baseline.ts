import type { StyleConfig } from '@Ordio/shared/schemas';
import {
  BASELINE_BAR_COUNT,
  BASELINE_BOTTOM_PAD_RATIO,
  BASELINE_GAP_RATIO,
  BASELINE_MIN_H_RATIO,
  BASELINE_RADIUS_RATIO,
  BASELINE_RANGE_H_RATIO,
  BASELINE_SIDE_PAD_RATIO,
  drawPillRect,
  getCurrentAmplitude,
} from './constants';

/**
 * The study's own bar shape: two offset sine waves beating against each other
 * so neighbouring bars never march in lockstep. Returns 0..1.
 */
function barTexture(index: number, currentTime: number): number {
  return (
    Math.abs(Math.sin(index * 0.7 + currentTime * 3.1)) * 0.6 +
    Math.abs(Math.sin(index * 1.9 - currentTime * 1.7)) * 0.4
  );
}

/**
 * Baseline bars — the waveform under the cream-block panel. Unlike the pill
 * bars, these are thin, square-ish, and sit ON a baseline near the bottom
 * edge growing upward only, never mirrored around a center line.
 *
 * The study drove the bars purely from its own sine texture; here that texture
 * is scaled by real audio amplitude, since its spec calls this a live
 * waveform and a flat-lining meter would be wrong in an export.
 */
export function drawBaselineWaveform(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  duration: number,
  waveformData: number[],
  style: StyleConfig,
  flipped = false
): void {
  const { width, height, waveColor } = style;

  const sidePad = width * BASELINE_SIDE_PAD_RATIO;
  const gap = width * BASELINE_GAP_RATIO;
  const radius = width * BASELINE_RADIUS_RATIO;
  const bottomPad = height * BASELINE_BOTTOM_PAD_RATIO;
  const minHeight = height * BASELINE_MIN_H_RATIO;
  const rangeHeight = height * BASELINE_RANGE_H_RATIO;

  const totalGaps = gap * (BASELINE_BAR_COUNT - 1);
  const barWidth = (width - sidePad * 2 - totalGaps) / BASELINE_BAR_COUNT;
  if (barWidth <= 0) return;

  const amplitude = getCurrentAmplitude(currentTime, duration, waveformData);
  // Keep the texture legible in quiet passages instead of collapsing to a line.
  const drive = Math.min(1, 0.35 + amplitude * 0.9);

  ctx.save();
  ctx.fillStyle = waveColor;

  for (let i = 0; i < BASELINE_BAR_COUNT; i++) {
    const barHeight = minHeight + barTexture(i, currentTime) * drive * rangeHeight;
    const x = sidePad + i * (barWidth + gap);
    // Flipped hangs the same bars from the top edge rather than mirroring them.
    const y = flipped ? bottomPad : height - bottomPad - barHeight;

    drawPillRect(ctx, x, y, barWidth, barHeight, radius);
    ctx.fill();
  }

  ctx.restore();
}
