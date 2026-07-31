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
  PHRASE_TOP_RATIO,
  resolveBlockTopForAlign,
  resolveLineX,
  resolveScalePivotX,
  type PhraseCaptionMetrics,
} from './shared';

interface ChunkWordLayout {
  word: Word;
  x: number;
  width: number;
  isAccented: boolean;
}

interface ChunkLayout {
  text: string;
  words: ChunkWordLayout[];
  totalWidth: number;
  spaceWidth: number;
}

function accentFont(style: StyleConfig, preset: CaptionStylePreset): string {
  const family = preset.accentFontFamily ?? style.fontFamily;
  return `italic 500 ${style.fontSize * 1.15}px "${family}", serif`;
}

function baseFont(style: StyleConfig): string {
  return `${FONT_WEIGHT} ${style.fontSize}px "${style.fontFamily}", sans-serif`;
}

/**
 * Lays out one chunk's words left-to-right, computing centering width. The
 * 'plain' fast path treats the chunk as a single string (cheaper, no reason
 * to split words that all render identically); 'accent-swap' styles need
 * per-word layout since the accented word may use a different font/color.
 */
function layoutChunk(
  ctx: CanvasRenderingContext2D,
  group: CaptionGroup,
  transcript: Word[],
  style: StyleConfig,
  preset: CaptionStylePreset,
  characterSpacing: number
): ChunkLayout {
  if (preset.fontTreatment !== 'accent-swap') {
    ctx.font = baseFont(style);
    return {
      text: group.text,
      words: [],
      totalWidth: measureTextWidth(ctx, group.text, characterSpacing),
      spaceWidth: 0,
    };
  }

  ctx.font = baseFont(style);
  const spaceWidth = measureTextWidth(ctx, ' ', characterSpacing);
  const accentFontStr = accentFont(style, preset);

  let cursor = 0;
  const words: ChunkWordLayout[] = group.wordIndices.map((globalIdx) => {
    const word = transcript[globalIdx];
    const isAccented = isGlobalWordIndexAccented(group, globalIdx);
    ctx.font = isAccented && preset.accentStyle === 'italic-glow' ? accentFontStr : baseFont(style);
    const width = measureTextWidth(ctx, word.text, characterSpacing);
    const x = cursor;
    cursor += width + spaceWidth;
    return { word, x, width, isAccented };
  });

  return { text: group.text, words, totalWidth: Math.max(0, cursor - spaceWidth), spaceWidth };
}

function drawChunk(
  ctx: CanvasRenderingContext2D,
  layout: ChunkLayout,
  style: StyleConfig,
  preset: CaptionStylePreset,
  centerX: number,
  lineY: number,
  characterSpacing: number
): void {
  const { textColor, fontSize } = style;
  const strokeWidthPx = (style.strokeWidth ?? preset.stroke?.defaultWidth ?? DEFAULT_STROKE_WIDTH_RATIO) * fontSize;
  const strokeColor = style.strokeColor ?? preset.stroke?.defaultColor ?? DEFAULT_STROKE_COLOR;

  if (layout.words.length === 0) {
    ctx.font = baseFont(style);
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeWidthPx;
    ctx.strokeStyle = strokeColor;
    drawSpacedText(ctx, layout.text, centerX, lineY, { textAlign: 'center', mode: 'stroke', characterSpacing });
    ctx.fillStyle = textColor;
    drawSpacedText(ctx, layout.text, centerX, lineY, { textAlign: 'center', mode: 'fill', characterSpacing });
    return;
  }

  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  let x = centerX - layout.totalWidth / 2;
  const accentFontStr = accentFont(style, preset);

  for (const w of layout.words) {
    const isItalicGlow = w.isAccented && preset.accentStyle === 'italic-glow';
    ctx.font = isItalicGlow ? accentFontStr : baseFont(style);

    if (!isItalicGlow) {
      ctx.lineWidth = strokeWidthPx;
      ctx.strokeStyle = strokeColor;
      drawSpacedText(ctx, w.word.text, x, lineY, { textAlign: 'left', mode: 'stroke', characterSpacing });
    }

    if (isItalicGlow) {
      ctx.save();
      ctx.shadowColor = style.glowColor ?? preset.glow?.defaultColor ?? '#FFFFFF';
      ctx.shadowBlur = (style.glowIntensity ?? preset.glow?.defaultIntensity ?? 0.6) * fontSize * 0.6;
      ctx.fillStyle = textColor;
      drawSpacedText(ctx, w.word.text, x, lineY, { textAlign: 'left', mode: 'fill', characterSpacing });
      ctx.restore();
    } else if (w.isAccented && preset.accentStyle === 'color') {
      ctx.fillStyle = style.accentColor ?? preset.accentColor ?? textColor;
      drawSpacedText(ctx, w.word.text, x, lineY, { textAlign: 'left', mode: 'fill', characterSpacing });
    } else {
      ctx.fillStyle = textColor;
      drawSpacedText(ctx, w.word.text, x, lineY, { textAlign: 'left', mode: 'fill', characterSpacing });
    }

    x += w.width + layout.spaceWidth;
  }
}

/**
 * Phrase-cut mechanic: a 2-3 word CaptionGroup chunk holds for its full
 * start/end window, then hard-cuts to the next group — no cross-fade. Used
 * by bold-outline, minimal-lower-third, big-statement, and script-accent.
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
  const maxTextWidth = getMaxCaptionTextWidth(width);
  const safeMargin = getCaptionSideMargin(width);
  const align = style.textAlign ?? DEFAULT_TEXT_ALIGN;
  const textY =
    resolveBlockTopForAlign(style.verticalAlign ?? DEFAULT_VERTICAL_ALIGN, height, lineHeight, PHRASE_TOP_RATIO) ??
    calculatePhraseTextY(height, layout, hasVisualZone, flipped, lineHeight);

  ctx.textBaseline = 'middle';
  const chunk = layoutChunk(ctx, group, transcript, style, preset, characterSpacing);
  const hookBoost = group.role === 'hook' ? HOOK_SCALE_MULTIPLIER : 1;
  const fitScale = (chunk.totalWidth > 0 ? Math.min(1, maxTextWidth / chunk.totalWidth) : 1) * hookBoost;
  // Both draw paths center on this point, so aligning the line is a matter of
  // moving its center rather than branching the drawing code.
  const centerX = resolveLineX(align, chunk.totalWidth, width, safeMargin) + chunk.totalWidth / 2;

  const offsetX = (captionTransform?.offsetXRatio ?? 0) * width;
  const offsetY = (captionTransform?.offsetYRatio ?? 0) * height;
  const manualScale = Math.max(0.4, Math.min(3, captionTransform?.scale ?? 1));
  const rotationRad = ((captionTransform?.rotationDeg ?? 0) * Math.PI) / 180;
  const blockCenterY = textY + lineHeight / 2;
  const pivotX = resolveScalePivotX(align, width, safeMargin);

  ctx.save();
  ctx.translate(pivotX + offsetX, blockCenterY + offsetY);
  ctx.rotate(rotationRad);
  ctx.scale(fitScale * manualScale, fitScale * manualScale);
  ctx.translate(-pivotX, -blockCenterY);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
  ctx.shadowBlur = Math.max(8, fontSize * 0.12);
  drawChunk(ctx, chunk, style, preset, centerX, textY + lineHeight / 2, characterSpacing);
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

  const maxTextWidth = getMaxCaptionTextWidth(style.width);
  const safeMargin = getCaptionSideMargin(style.width);
  const align = style.textAlign ?? DEFAULT_TEXT_ALIGN;
  const characterSpacing = style.characterSpacing ?? 0;
  const lineHeight = style.fontSize * (style.lineHeight ?? 1.4);
  const textY =
    resolveBlockTopForAlign(style.verticalAlign ?? DEFAULT_VERTICAL_ALIGN, style.height, lineHeight, PHRASE_TOP_RATIO) ??
    calculatePhraseTextY(style.height, layout, hasVisualZone, flipped, lineHeight);
  const chunk = layoutChunk(ctx, group, transcript, style, preset, characterSpacing);
  const fitScale =
    (chunk.totalWidth > 0 ? Math.min(1, maxTextWidth / chunk.totalWidth) : 1) *
    (group.role === 'hook' ? HOOK_SCALE_MULTIPLIER : 1);
  const pivotX = resolveScalePivotX(align, style.width, safeMargin);
  const centerX = resolveLineX(align, chunk.totalWidth, style.width, safeMargin) + chunk.totalWidth / 2;

  return {
    text: chunk.text,
    lines: [chunk.text],
    // Reported pre-scale; the caller applies fitScale about pivotX.
    centerX,
    textY,
    lineHeight,
    blockWidth: chunk.totalWidth,
    blockHeight: lineHeight,
    blockCenterY: textY + lineHeight / 2,
    fitScale,
    pivotX,
  };
}
