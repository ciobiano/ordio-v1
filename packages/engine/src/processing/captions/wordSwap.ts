import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CanvasLayout, CaptionGroup, CaptionTransform } from '../../types';
import { drawSpacedText, measureTextWidth } from '../../video/textLayout';
import { getCaptionStylePreset } from '../../captions/presets';
import {
  calculatePhraseTextY,
  DEFAULT_STROKE_COLOR,
  DEFAULT_STROKE_WIDTH_RATIO,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  findActiveWordIndex,
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

interface ActiveWordScene {
  text: string;
  isAccented: boolean;
  isHook: boolean;
}

function getActiveWordScene(
  transcript: Word[],
  currentTime: number,
  groups: CaptionGroup[] | undefined
): ActiveWordScene | null {
  const idx = findActiveWordIndex(transcript, currentTime);
  if (idx < 0) return null;

  const activeGroup = getActiveCaptionGroup(groups ?? [], currentTime);
  return {
    text: transcript[idx].text,
    isAccented: isGlobalWordIndexAccented(activeGroup, idx),
    isHook: activeGroup?.role === 'hook',
  };
}

/**
 * Word-swap mechanic: exactly one word on screen at a time, hard-cut to the
 * next word on its own timestamp boundary — no cross-fade. Used by the
 * word-pop caption style.
 */
export function drawWordSwapCaptions(
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
  if (transcript.length === 0) return;
  if (captionTransform && !captionTransform.visible) return;

  const scene = getActiveWordScene(transcript, currentTime, groups);
  if (!scene) return;

  const {
    width,
    height,
    textColor,
    fontFamily,
    fontSize,
    characterSpacing = 0,
    lineHeight: lineHeightMultiplier = 1.4,
  } = style;
  const preset = getCaptionStylePreset(style.captionStyleId);

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const maxTextWidth = getMaxCaptionTextWidth(width);
  const safeMargin = getCaptionSideMargin(width);
  const align = style.textAlign ?? DEFAULT_TEXT_ALIGN;
  const lineHeight = fontSize * lineHeightMultiplier;
  const textY =
    resolveBlockTopForAlign(style.verticalAlign ?? DEFAULT_VERTICAL_ALIGN, height, lineHeight, PHRASE_TOP_RATIO) ??
    calculatePhraseTextY(height, layout, hasVisualZone, flipped, lineHeight);

  const measuredWidth = measureTextWidth(ctx, scene.text, characterSpacing);
  const hookBoost = scene.isHook ? HOOK_SCALE_MULTIPLIER : 1;
  const fitScale = (measuredWidth > 0 ? Math.min(1, maxTextWidth / measuredWidth) : 1) * hookBoost;
  const centerX = resolveLineX(align, measuredWidth, width, safeMargin) + measuredWidth / 2;

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
  ctx.lineJoin = 'round';
  ctx.lineWidth = (style.strokeWidth ?? preset.stroke?.defaultWidth ?? DEFAULT_STROKE_WIDTH_RATIO) * fontSize;
  ctx.strokeStyle = style.strokeColor ?? preset.stroke?.defaultColor ?? DEFAULT_STROKE_COLOR;
  const lineY = textY + lineHeight / 2;
  drawSpacedText(ctx, scene.text, centerX, lineY, { textAlign: 'center', mode: 'stroke', characterSpacing });

  const isColorAccent = scene.isAccented && preset.fontTreatment === 'accent-swap' && preset.accentStyle === 'color';
  ctx.fillStyle = isColorAccent ? (style.accentColor ?? preset.accentColor ?? textColor) : textColor;
  drawSpacedText(ctx, scene.text, centerX, lineY, { textAlign: 'center', mode: 'fill', characterSpacing });
  ctx.restore();
}

export function measureWordSwapCaptionBlock(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  flipped = false,
  groups?: CaptionGroup[]
): PhraseCaptionMetrics | null {
  if (transcript.length === 0) return null;

  const scene = getActiveWordScene(transcript, currentTime, groups);
  if (!scene) return null;

  ctx.font = `${FONT_WEIGHT} ${style.fontSize}px "${style.fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';

  const maxTextWidth = getMaxCaptionTextWidth(style.width);
  const safeMargin = getCaptionSideMargin(style.width);
  const align = style.textAlign ?? DEFAULT_TEXT_ALIGN;
  const characterSpacing = style.characterSpacing ?? 0;
  const lineHeight = style.fontSize * (style.lineHeight ?? 1.4);
  const textY =
    resolveBlockTopForAlign(style.verticalAlign ?? DEFAULT_VERTICAL_ALIGN, style.height, lineHeight, PHRASE_TOP_RATIO) ??
    calculatePhraseTextY(style.height, layout, hasVisualZone, flipped, lineHeight);
  const blockWidth = measureTextWidth(ctx, scene.text, characterSpacing);

  return {
    text: scene.text,
    lines: [scene.text],
    // Reported pre-scale; the caller applies fitScale about pivotX.
    centerX: resolveLineX(align, blockWidth, style.width, safeMargin) + blockWidth / 2,
    textY,
    lineHeight,
    blockWidth,
    blockHeight: lineHeight,
    blockCenterY: textY + lineHeight / 2,
    fitScale: blockWidth > 0 ? Math.min(1, maxTextWidth / blockWidth) : 1,
    pivotX: resolveScalePivotX(align, style.width, safeMargin),
  };
}
