import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CanvasLayout, CaptionGroup, CaptionTransform } from '../../types';
import { drawSpacedText, measureTextWidth } from '../../video/textLayout';
import { getCaptionStylePreset, type CaptionStylePreset } from '../../captions/presets';
import {
  calculatePhraseTextY,
  DEFAULT_STROKE_COLOR,
  DEFAULT_STROKE_WIDTH_RATIO,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  FONT_WEIGHT,
  getActiveCaptionGroup,
  getCaptionSideMargin,
  getMaxCaptionTextWidth,
  HOOK_SCALE_MULTIPLIER,
  isGlobalWordIndexAccented,
  layoutWrappedLines,
  PHRASE_TOP_RATIO,
  resolveBlockTopForAlign,
  resolveLineX,
  resolveScalePivotX,
  type LayoutWord,
  type LineLayout,
  type PhraseCaptionMetrics,
  type TextAlign,
} from './shared';

/** A measured word plus whether this style should set it apart. */
type PhraseWord = LayoutWord & { isAccented: boolean };

interface PhraseLayout {
  text: string;
  lines: PhraseWord[][];
  wrap: LineLayout;
  spaceWidth: number;
  align: TextAlign;
  safeMargin: number;
}

function accentFont(style: StyleConfig, preset: CaptionStylePreset): string {
  const family = preset.accentFontFamily ?? style.fontFamily;
  return `italic 500 ${style.fontSize * 1.15}px "${family}", serif`;
}

function baseFont(style: StyleConfig): string {
  return `${FONT_WEIGHT} ${style.fontSize}px "${style.fontFamily}", sans-serif`;
}

/** Rendered width of one wrapped line, including the spaces between its words. */
function lineWidth(line: PhraseWord[], spaceWidth: number): number {
  if (line.length === 0) return 0;
  return line.reduce((sum, word) => sum + word.wordWidth, 0) + spaceWidth * (line.length - 1);
}

/**
 * Measures the active chunk word by word and wraps it at the style's own font
 * size. Every word is measured individually — including with the accent face
 * where the style swaps it — because the wrap has to know real widths.
 *
 * Notably this does NOT shrink long chunks to fit one line, which is what it
 * used to do: that made the caption a different size on every phrase.
 */
function layoutChunk(
  ctx: CanvasRenderingContext2D,
  group: CaptionGroup,
  transcript: Word[],
  style: StyleConfig,
  preset: CaptionStylePreset,
  characterSpacing: number,
  maxTextWidth: number
): PhraseLayout {
  const isAccentSwap = preset.fontTreatment === 'accent-swap';
  const accentFontStr = accentFont(style, preset);

  ctx.font = baseFont(style);
  const spaceWidth = measureTextWidth(ctx, ' ', characterSpacing);

  const words: PhraseWord[] = group.wordIndices.map((globalIdx, i) => {
    const word = transcript[globalIdx];
    const isAccented = isAccentSwap && isGlobalWordIndexAccented(group, globalIdx);
    ctx.font = isAccented && preset.accentStyle === 'italic-glow' ? accentFontStr : baseFont(style);
    const next = transcript[group.wordIndices[i + 1]];
    return {
      text: word.text,
      start: word.start,
      end: word.end,
      wordWidth: measureTextWidth(ctx, word.text, characterSpacing),
      pauseToNext: next ? Math.max(0, next.start - word.end) : 0,
      isAccented,
    };
  });

  const wrap = layoutWrappedLines(words, spaceWidth, maxTextWidth, {
    fitToWidth: style.autoFit,
  });

  return {
    text: group.text,
    lines: wrap.lines as PhraseWord[][],
    wrap,
    spaceWidth,
    align: style.textAlign ?? DEFAULT_TEXT_ALIGN,
    safeMargin: getCaptionSideMargin(style.width),
  };
}

function drawWord(
  ctx: CanvasRenderingContext2D,
  word: PhraseWord,
  style: StyleConfig,
  preset: CaptionStylePreset,
  x: number,
  lineY: number,
  characterSpacing: number
): void {
  const { textColor, fontSize } = style;
  const strokeWidthPx = (style.strokeWidth ?? preset.stroke?.defaultWidth ?? DEFAULT_STROKE_WIDTH_RATIO) * fontSize;
  const strokeColor = style.strokeColor ?? preset.stroke?.defaultColor ?? DEFAULT_STROKE_COLOR;
  const isItalicGlow = word.isAccented && preset.accentStyle === 'italic-glow';

  ctx.font = isItalicGlow ? accentFont(style, preset) : baseFont(style);
  ctx.lineJoin = 'round';

  if (!isItalicGlow) {
    ctx.lineWidth = strokeWidthPx;
    ctx.strokeStyle = strokeColor;
    drawSpacedText(ctx, word.text, x, lineY, { textAlign: 'left', mode: 'stroke', characterSpacing });
  }

  if (isItalicGlow) {
    ctx.save();
    ctx.shadowColor = style.glowColor ?? preset.glow?.defaultColor ?? '#FFFFFF';
    ctx.shadowBlur = (style.glowIntensity ?? preset.glow?.defaultIntensity ?? 0.6) * fontSize * 0.6;
    ctx.fillStyle = textColor;
    drawSpacedText(ctx, word.text, x, lineY, { textAlign: 'left', mode: 'fill', characterSpacing });
    ctx.restore();
    return;
  }

  ctx.fillStyle =
    word.isAccented && preset.accentStyle === 'color'
      ? style.accentColor ?? preset.accentColor ?? textColor
      : textColor;
  drawSpacedText(ctx, word.text, x, lineY, { textAlign: 'left', mode: 'fill', characterSpacing });
}

/** Union of the aligned lines — the block's real bounds once each line is placed. */
function blockBounds(layout: PhraseLayout, canvasWidth: number): { left: number; right: number } {
  let left = Infinity;
  let right = -Infinity;
  for (const line of layout.lines) {
    const lw = lineWidth(line, layout.spaceWidth);
    const x = resolveLineX(layout.align, lw, canvasWidth, layout.safeMargin);
    left = Math.min(left, x);
    right = Math.max(right, x + lw);
  }
  return Number.isFinite(left) ? { left, right } : { left: 0, right: 0 };
}

/**
 * Phrase-cut mechanic: a CaptionGroup chunk holds for its full start/end
 * window, then hard-cuts to the next group — no cross-fade. Used by
 * bold-outline, minimal-lower-third, big-statement, and script-accent.
 * Requires captionGroups (always populated post-transcription in this app);
 * with none, there is nothing to render.
 */
export function drawPhraseCutCaptions(
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
  if (transcript.length === 0 || !groups?.length) return;
  if (captionTransform && !captionTransform.visible) return;

  const group = getActiveCaptionGroup(groups, currentTime);
  if (!group) return;

  const preset = getCaptionStylePreset(style.captionStyleId);
  const { width, height, characterSpacing = 0, lineHeight: lineHeightMultiplier = 1.4, fontSize } = style;
  const lineHeight = fontSize * lineHeightMultiplier;
  const maxTextWidth = getMaxCaptionTextWidth(width, preset.textWidthRatio);
  const safeMargin = getCaptionSideMargin(width);
  const align = style.textAlign ?? DEFAULT_TEXT_ALIGN;

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const chunk = layoutChunk(ctx, group, transcript, style, preset, characterSpacing, maxTextWidth);

  const blockHeight = chunk.lines.length * lineHeight;
  const textY =
    resolveBlockTopForAlign(style.verticalAlign ?? DEFAULT_VERTICAL_ALIGN, height, blockHeight, PHRASE_TOP_RATIO) ??
    calculatePhraseTextY(height, layout, hasVisualZone, flipped, blockHeight);

  const hookBoost = group.role === 'hook' ? HOOK_SCALE_MULTIPLIER : 1;
  // chunk.wrap.scale is 1 unless a single word is wider than the frame, so
  // the rendered size no longer changes from one phrase to the next.
  const renderScale = chunk.wrap.scale * hookBoost;

  const offsetX = (captionTransform?.offsetXRatio ?? 0) * width;
  const offsetY = (captionTransform?.offsetYRatio ?? 0) * height;
  const manualScale = Math.max(0.4, Math.min(3, captionTransform?.scale ?? 1));
  const rotationRad = ((captionTransform?.rotationDeg ?? 0) * Math.PI) / 180;
  const blockCenterY = textY + blockHeight / 2;
  const pivotX = resolveScalePivotX(align, width, safeMargin);

  ctx.save();
  ctx.translate(pivotX + offsetX, blockCenterY + offsetY);
  ctx.rotate(rotationRad);
  ctx.scale(renderScale * manualScale, renderScale * manualScale);
  ctx.translate(-pivotX, -blockCenterY);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = Math.max(8, fontSize * 0.12);

  for (let li = 0; li < chunk.lines.length; li++) {
    const line = chunk.lines[li];
    const lineY = textY + li * lineHeight + lineHeight / 2;
    let x = resolveLineX(align, lineWidth(line, chunk.spaceWidth), width, safeMargin);

    for (const word of line) {
      drawWord(ctx, word, style, preset, x, lineY, characterSpacing);
      x += word.wordWidth + chunk.spaceWidth;
    }
  }

  ctx.restore();
}

export function measurePhraseCutCaptionBlock(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  flipped = false,
  groups?: CaptionGroup[]
): PhraseCaptionMetrics | null {
  if (transcript.length === 0 || !groups?.length) return null;

  const group = getActiveCaptionGroup(groups, currentTime);
  if (!group) return null;

  const preset = getCaptionStylePreset(style.captionStyleId);
  ctx.font = baseFont(style);
  ctx.textBaseline = 'middle';

  const maxTextWidth = getMaxCaptionTextWidth(style.width, preset.textWidthRatio);
  const safeMargin = getCaptionSideMargin(style.width);
  const align = style.textAlign ?? DEFAULT_TEXT_ALIGN;
  const characterSpacing = style.characterSpacing ?? 0;
  const lineHeight = style.fontSize * (style.lineHeight ?? 1.4);
  const chunk = layoutChunk(ctx, group, transcript, style, preset, characterSpacing, maxTextWidth);

  const blockHeight = chunk.lines.length * lineHeight;
  const textY =
    resolveBlockTopForAlign(style.verticalAlign ?? DEFAULT_VERTICAL_ALIGN, style.height, blockHeight, PHRASE_TOP_RATIO) ??
    calculatePhraseTextY(style.height, layout, hasVisualZone, flipped, blockHeight);

  const { left, right } = blockBounds(chunk, style.width);

  return {
    text: chunk.text,
    lines: chunk.lines.map((line) => line.map((w) => w.text).join(' ')),
    // Reported pre-scale; the caller applies fitScale about pivotX.
    centerX: (left + right) / 2,
    textY,
    lineHeight,
    blockWidth: right - left,
    blockHeight,
    blockCenterY: textY + blockHeight / 2,
    fitScale: chunk.wrap.scale * (group.role === 'hook' ? HOOK_SCALE_MULTIPLIER : 1),
    pivotX: resolveScalePivotX(align, style.width, safeMargin),
  };
}
