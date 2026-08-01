import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CanvasLayout, CaptionGroup, CaptionTransform } from '../../types';
import { drawSpacedText, measureTextWidth } from '../../video/textLayout';
import { getCaptionStylePreset } from '../../captions/presets';
import {
  calculatePhraseTextY,
  CAPTION_VERTICAL_SAFE_RATIO,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  dimColor,
  getActiveCaptionGroup,
  getCaptionSideMargin,
  HIGHLIGHT_LINE_HEIGHT_RATIO,
  HOOK_SCALE_MULTIPLIER,
  layoutWrappedLines,
  ORPHAN_MAX_CHARS,
  buildCaptionScene,
  PROGRESSIVE_REVEAL_DIM_OPACITY,
  PROGRESSIVE_REVEAL_TEXT_WIDTH_RATIO,
  PROGRESSIVE_REVEAL_TOP_RATIO,
  resolveBlockTopForAlign,
  resolveFontWeight,
  resolveLineX,
  resolveScalePivotX,
  scaleAboutPivot,
  type HighlightCaptionMetrics,
  type LayoutWord,
  type LineLayout,
  type TextAlign,
  type VerticalAlign,
} from './shared';

interface PreparedRevealScene {
  width: number;
  height: number;
  textColor: string;
  dimTextColor: string;
  font: string;
  characterSpacing: number;
  lineHeight: number;
  lines: LayoutWord[][];
  layout: LineLayout;
  align: TextAlign;
  safeMargin: number;
  spaceWidth: number;
  blockTop: number;
  blockCenterY: number;
  hookBoost: number;
}

/**
 * Vertical anchor. With no waveform or graphic sharing the frame the block
 * sits at optical center (the design's composition); otherwise it defers to
 * the same above-the-waveform placement every other mechanic uses.
 */
function resolveBlockTop(
  vAlign: VerticalAlign,
  height: number,
  blockHeight: number,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  flipped: boolean
): number {
  const anchored = resolveBlockTopForAlign(vAlign, height, blockHeight, PROGRESSIVE_REVEAL_TOP_RATIO);
  if (anchored !== null) return anchored;

  if (hasVisualZone) {
    return calculatePhraseTextY(height, layout, hasVisualZone, flipped, blockHeight);
  }
  const safePad = height * CAPTION_VERTICAL_SAFE_RATIO;
  return Math.max(safePad, (height - blockHeight) / 2);
}

function prepareRevealScene(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  flipped: boolean,
  groups?: CaptionGroup[]
): PreparedRevealScene | null {
  if (transcript.length === 0) return null;

  const {
    width,
    height,
    textColor,
    fontFamily,
    fontSize,
    characterSpacing = 0,
    lineHeight: lineHeightMultiplier = HIGHLIGHT_LINE_HEIGHT_RATIO,
  } = style;

  const preset = getCaptionStylePreset(style.captionStyleId);
  const scene = buildCaptionScene(transcript, currentTime, style.chunkWords ?? preset.defaultChunkWords);
  if (scene.length === 0) return null;

  const font = `${resolveFontWeight(fontFamily)} ${fontSize}px "${fontFamily}", serif`;

  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const safeMargin = getCaptionSideMargin(width);
  const maxWidth = Math.min(width - safeMargin * 2, width * PROGRESSIVE_REVEAL_TEXT_WIDTH_RATIO);
  const spaceWidth = measureTextWidth(ctx, ' ', characterSpacing);
  const lineHeight = fontSize * lineHeightMultiplier;

  const measured: LayoutWord[] = scene.map((w) => ({
    text: w.text,
    start: w.start,
    end: w.end,
    wordWidth: measureTextWidth(ctx, w.text, characterSpacing),
    pauseToNext: 0,
  }));
  for (let i = 0; i < measured.length - 1; i++) {
    measured[i].pauseToNext = Math.max(0, measured[i + 1].start - measured[i].end);
  }

  const wrapLayout = layoutWrappedLines(measured, spaceWidth, maxWidth, { orphanMaxChars: ORPHAN_MAX_CHARS });
  const blockHeight = wrapLayout.lines.length * lineHeight;
  const blockTop = resolveBlockTop(
    style.verticalAlign ?? DEFAULT_VERTICAL_ALIGN,
    height,
    blockHeight,
    layout,
    hasVisualZone,
    flipped
  );
  const activeGroup = getActiveCaptionGroup(groups ?? [], currentTime);

  return {
    width,
    height,
    textColor,
    dimTextColor: dimColor(textColor, PROGRESSIVE_REVEAL_DIM_OPACITY),
    font,
    characterSpacing,
    lineHeight,
    lines: wrapLayout.lines,
    layout: wrapLayout,
    align: style.textAlign ?? DEFAULT_TEXT_ALIGN,
    safeMargin,
    spaceWidth,
    blockTop,
    blockCenterY: blockTop + blockHeight / 2,
    hookBoost: activeGroup?.role === 'hook' ? HOOK_SCALE_MULTIPLIER : 1,
  };
}

/** Rendered width of one wrapped line, including the spaces between its words. */
function lineWidth(line: LayoutWord[], spaceWidth: number): number {
  if (line.length === 0) return 0;
  return line.reduce((sum, word) => sum + word.wordWidth, 0) + spaceWidth * (line.length - 1);
}

export function measureProgressiveRevealCaptionBlock(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  flipped = false,
  groups?: CaptionGroup[]
): HighlightCaptionMetrics | null {
  const prep = prepareRevealScene(ctx, currentTime, transcript, style, layout, hasVisualZone, flipped, groups);
  if (!prep) return null;

  const { width, lines, spaceWidth, align, safeMargin, layout: wrap, lineHeight, blockCenterY, hookBoost } = prep;
  const scale = wrap.scale * hookBoost;
  const pivotX = resolveScalePivotX(align, width, safeMargin);

  // Aligned lines can each start somewhere different, so the block's bounds
  // are the union of the lines rather than a single centered column.
  let left = Infinity;
  let right = -Infinity;
  for (const line of lines) {
    const lw = lineWidth(line, spaceWidth);
    const x = resolveLineX(align, lw, width, safeMargin);
    left = Math.min(left, x);
    right = Math.max(right, x + lw);
  }
  if (!Number.isFinite(left)) return null;

  return {
    centerX: scaleAboutPivot((left + right) / 2, pivotX, scale),
    blockCenterY,
    blockWidth: (right - left) * scale,
    blockHeight: lines.length * lineHeight * scale,
    layoutScale: scale,
    pivotX,
  };
}

/**
 * Progressive-reveal mechanic: a whole sentence holds on screen while each
 * word flips from dim to full color the moment its own timestamp arrives,
 * then the block hard-cuts to the next sentence. Used by editorial-reveal.
 */
export function drawProgressiveRevealCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  flipped = false,
  groups?: CaptionGroup[],
  captionTransform?: CaptionTransform
): void {
  if (captionTransform && !captionTransform.visible) return;

  const prep = prepareRevealScene(ctx, currentTime, transcript, style, layout, hasVisualZone, flipped, groups);
  if (!prep) return;

  const {
    width,
    height,
    textColor,
    dimTextColor,
    font,
    characterSpacing,
    lineHeight,
    lines,
    layout: wrap,
    align,
    safeMargin,
    spaceWidth,
    blockTop,
    blockCenterY,
    hookBoost,
  } = prep;

  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  // 0 1px 8px rgba(0,0,0,0.7) from the study — invisible on its black panels,
  // and doing the real work on the one meant to sit over footage.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = Math.max(4, lineHeight * 0.14);
  ctx.shadowOffsetY = Math.max(1, lineHeight * 0.018);

  const offsetX = (captionTransform?.offsetXRatio ?? 0) * width;
  const offsetY = (captionTransform?.offsetYRatio ?? 0) * height;
  const manualScale = Math.max(0.4, Math.min(3, captionTransform?.scale ?? 1));
  const rotationRad = ((captionTransform?.rotationDeg ?? 0) * Math.PI) / 180;
  const combinedScale = manualScale * wrap.scale * hookBoost;
  const pivotX = resolveScalePivotX(align, width, safeMargin);

  ctx.save();
  ctx.translate(pivotX + offsetX, blockCenterY + offsetY);
  ctx.rotate(rotationRad);
  ctx.scale(combinedScale, combinedScale);
  ctx.translate(-pivotX, -blockCenterY);

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lineY = blockTop + li * lineHeight + lineHeight / 2;
    let x = resolveLineX(align, lineWidth(line, spaceWidth), width, safeMargin);

    for (const word of line) {
      // Hard state flip on the word's own start — no easing, matching the
      // design's "nothing moves, only value changes" rule.
      ctx.fillStyle = currentTime >= word.start ? textColor : dimTextColor;
      drawSpacedText(ctx, word.text, x, lineY, { textAlign: 'left', characterSpacing });
      x += word.wordWidth + spaceWidth;
    }
  }

  ctx.restore();
}
