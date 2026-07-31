import type { StyleConfig } from '@Ordio/shared/schemas';
import {
  ORB_BREATHE_FROM,
  ORB_BREATHE_PERIOD,
  ORB_BREATHE_TO,
  ORB_CENTER_Y,
  ORB_CROSSHAIR_OVERSHOOT,
  ORB_CROSSHAIR_X_ALPHA,
  ORB_CROSSHAIR_Y_ALPHA,
  ORB_RADIUS_RATIO,
  ORB_RING_A_ALPHA,
  ORB_RING_A_FROM,
  ORB_RING_A_PERIOD,
  ORB_RING_A_TO,
  ORB_RING_B_ALPHA,
  ORB_RING_B_FROM,
  ORB_RING_B_PERIOD,
  ORB_RING_B_TO,
  ORB_SHELL_ALPHA,
  ORB_SPIN_PERIOD,
  ORB_STROKE_RATIO,
} from './constants';

/**
 * A CSS `0%,100% -> from; 50% -> to` ease-in-out loop, as a cosine. Matches
 * the shape of the design's keyframes closely enough that the orb reads
 * identically in motion, without hand-rolling a cubic-bezier sampler.
 */
function keyframeLoop(time: number, period: number, from: number, to: number): number {
  const progress = (1 - Math.cos((time / period) * Math.PI * 2)) / 2;
  return from + (to - from) * progress;
}

/**
 * Orb — the wireframe sphere from the caption-presets design study, ported
 * 1:1: a static outer shell plus two rings that collapse through opposite
 * axes on their own periods, over an overshooting crosshair, the whole thing
 * spinning slowly and breathing.
 *
 * All geometry is expressed relative to the orb's own radius (the design's
 * 1.5px stroke on an 88px radius, its crosshair reaching 128% of the box),
 * so it holds its proportions at any canvas size.
 *
 * Deliberately NOT audio-reactive. It occupies the visual slot the waveform
 * variants share, but in the design it is a steady brand element on its own
 * clock, not a level meter — so it ignores waveformData entirely and keeps
 * moving through silence.
 */
export function drawOrbWaveform(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  style: StyleConfig,
  centerYFraction?: number
): void {
  const { width, height, waveColor } = style;
  const cx = width / 2;
  const cy = height * (centerYFraction ?? ORB_CENTER_Y);
  const smallerDim = Math.min(width, height);

  const breathe = keyframeLoop(currentTime, ORB_BREATHE_PERIOD, ORB_BREATHE_FROM, ORB_BREATHE_TO);
  const radius = smallerDim * ORB_RADIUS_RATIO * breathe;

  // 42s linear rotation. Invisible on the shell itself — it's the crosshair
  // and the collapsing rings that make the spin read.
  const spin = ((currentTime % ORB_SPIN_PERIOD) / ORB_SPIN_PERIOD) * Math.PI * 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spin);
  ctx.strokeStyle = waveColor;
  ctx.lineWidth = Math.max(1, radius * ORB_STROKE_RATIO);
  ctx.lineCap = 'butt';

  // Crosshair, under the rings, overshooting the sphere on both axes.
  const reach = radius * ORB_CROSSHAIR_OVERSHOOT;
  ctx.globalAlpha = ORB_CROSSHAIR_X_ALPHA;
  ctx.beginPath();
  ctx.moveTo(0, -reach);
  ctx.lineTo(0, reach);
  ctx.stroke();

  ctx.globalAlpha = ORB_CROSSHAIR_Y_ALPHA;
  ctx.beginPath();
  ctx.moveTo(-reach, 0);
  ctx.lineTo(reach, 0);
  ctx.stroke();

  // Static outer shell.
  ctx.globalAlpha = ORB_SHELL_ALPHA;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Ring A — horizontal radius collapses to 12% and back over 9s.
  ctx.globalAlpha = ORB_RING_A_ALPHA;
  ctx.beginPath();
  ctx.ellipse(
    0,
    0,
    radius * keyframeLoop(currentTime, ORB_RING_A_PERIOD, ORB_RING_A_FROM, ORB_RING_A_TO),
    radius,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  // Ring B — starts nearly flat at 14% and opens out over 13s, the inverse
  // phase of ring A. The two crossing at different rates is what sells it as
  // a rotating globe instead of concentric circles.
  ctx.globalAlpha = ORB_RING_B_ALPHA;
  ctx.beginPath();
  ctx.ellipse(
    0,
    0,
    radius,
    radius * keyframeLoop(currentTime, ORB_RING_B_PERIOD, ORB_RING_B_FROM, ORB_RING_B_TO),
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  ctx.restore();
  ctx.globalAlpha = 1;

}
