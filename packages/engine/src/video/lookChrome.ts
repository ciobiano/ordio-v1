import type { StyleConfig } from '@Ordio/shared/schemas';
import type { WaveformVariant } from '../types';
import { drawSpacedText, measureTextWidth } from './textLayout';

/**
 * Per-look chrome: the small fixed marks a look's composition includes beyond
 * its captions and visual — the orb panel's URL slug, the cream panel's
 * wordmark. Kept out of the caption and waveform renderers so neither has to
 * know about branding, and drawn under the watermark layer.
 *
 * Both strings are the design study's own. Promote them to StyleConfig if a
 * creator ever needs to put their own handle here.
 */

// Orb panel: mono slug + blinking caret, top-right, from a 360px-wide frame.
const TAG_TEXT = 'ordio.ai/presets';
const TAG_INSET_RATIO = 22 / 360;
const TAG_FONT_RATIO = 10 / 360;
const TAG_TRACKING_EM = 0.04;
const TAG_ALPHA = 0.72;
const TAG_GAP_RATIO = 6 / 360;
const TAG_CARET_W_RATIO = 2 / 360;
const TAG_CARET_H_RATIO = 11 / 360;
const TAG_CARET_COLOR = '#D81E0B';
const TAG_CARET_PERIOD = 1;

// Cream panel: wordmark top-right in the same maroon family as the type.
const WORDMARK_TEXT = 'Ordio';
const WORDMARK_INSET_RATIO = 26 / 360;
const WORDMARK_FONT_RATIO = 15 / 360;
const WORDMARK_TRACKING_EM = -0.01;
const WORDMARK_COLOR = '#8D1107';

function drawOrbTag(ctx: CanvasRenderingContext2D, currentTime: number, style: StyleConfig): void {
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

function drawCreamWordmark(ctx: CanvasRenderingContext2D, style: StyleConfig): void {
  const { width } = style;
  const inset = width * WORDMARK_INSET_RATIO;
  const fontSize = width * WORDMARK_FONT_RATIO;
  const tracking = fontSize * WORDMARK_TRACKING_EM;

  ctx.save();
  ctx.font = `600 ${fontSize}px "Instrument Sans", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = WORDMARK_COLOR;

  const textX = width - inset - measureTextWidth(ctx, WORDMARK_TEXT, tracking);
  drawSpacedText(ctx, WORDMARK_TEXT, textX, inset + fontSize / 2, {
    textAlign: 'left',
    characterSpacing: tracking,
  });
  ctx.restore();
}

export function drawLookChrome(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  style: StyleConfig,
  waveformStyle: WaveformVariant
): void {
  if (waveformStyle === 'orb') drawOrbTag(ctx, currentTime, style);
  if (style.captionStyleId === 'cream-block') drawCreamWordmark(ctx, style);
}
