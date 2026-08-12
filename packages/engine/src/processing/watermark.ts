import type { StyleConfig } from '@Ordio/shared/schemas';
import { drawSpacedText, measureTextWidth } from '../video/textLayout';

/**
 * The watermark: a monospace slug with a blinking caret, top-right.
 *
 * This started as chrome belonging to the orb look alone and is now the only
 * mark Ordio puts on an export. The previous general watermark ("Ordio by
 * Kaine Studio", 14px sans, top-left) is gone, as is the cream look's separate
 * wordmark. One mark, one place, every look.
 *
 * Colour comes from `style.textColor` rather than a constant, which is what
 * lets a mark designed for one composition sit on all of them: it inherits
 * whatever contrast the look already established against its own background.
 *
 * Every ratio is of canvas width, taken from the study's 360px-wide frame, so
 * the mark scales with the export rather than shrinking into a 1080p corner.
 */

const TAG_TEXT = 'ordio.space/create';
const TAG_INSET_RATIO = 22 / 360;
const TAG_FONT_RATIO = 10 / 360;
const TAG_TRACKING_EM = 0.04;
const TAG_ALPHA = 0.72;
const TAG_GAP_RATIO = 6 / 360;
const TAG_CARET_W_RATIO = 2 / 360;
const TAG_CARET_H_RATIO = 11 / 360;
const TAG_CARET_COLOR = '#D81E0B';
const TAG_CARET_PERIOD = 1;

export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  style: StyleConfig
): void {
  const { width, textColor } = style;
  const inset = width * TAG_INSET_RATIO;
  const fontSize = width * TAG_FONT_RATIO;
  const tracking = fontSize * TAG_TRACKING_EM;
  const caretW = Math.max(1, width * TAG_CARET_W_RATIO);
  const caretH = width * TAG_CARET_H_RATIO;
  const gap = width * TAG_GAP_RATIO;

  ctx.save();
  ctx.font = `400 ${fontSize}px ui-monospace, "SFMono-Regular", Menlo, monospace`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // Flex row anchored right: [text][gap][caret], caret flush to the inset.
  const caretX = width - inset - caretW;
  const textX = caretX - gap - measureTextWidth(ctx, TAG_TEXT, tracking);
  const centerY = inset + caretH / 2;

  ctx.globalAlpha = TAG_ALPHA;
  ctx.fillStyle = textColor;
  drawSpacedText(ctx, TAG_TEXT, textX, centerY, { textAlign: 'left', characterSpacing: tracking });

  // Hard on/off at the half second — CSS steps(1,end), not a fade.
  if (currentTime % TAG_CARET_PERIOD < TAG_CARET_PERIOD / 2) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = TAG_CARET_COLOR;
    ctx.fillRect(caretX, centerY - caretH / 2, caretW, caretH);
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}
