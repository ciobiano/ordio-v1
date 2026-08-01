import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionGroup, CaptionTransform } from '../../types';
import { drawSpacedText, measureTextWidth } from '../../video/textLayout';
import { getCaptionStylePreset } from '../../captions/presets';
import {
  buildCaptionScene,
  CAPTION_VERTICAL_SAFE_RATIO,
  CHIP_PADDING_X_RATIO,
  CHIP_PADDING_Y_RATIO,
  CHIP_RADIUS_RATIO,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  FONT_WEIGHT,
  getActiveCaptionGroup,
  HIGHLIGHT_LINE_HEIGHT_RATIO,
  HIGHLIGHT_TEXT_WIDTH_RATIO,
  HIGHLIGHT_TOP_RATIO,
  HOOK_SCALE_MULTIPLIER,
  layoutWrappedLines,
  ORPHAN_MAX_CHARS,
  resolveBlockTopForAlign,
  resolveLineX,
  resolveScalePivotX,
  scaleAboutPivot,
  type HighlightCaptionMetrics,
  type LayoutWord,
  type LineLayout,
  type TextAlign,
} from './shared';

const CAPTION_SIDE_MARGIN_PX = 2;

/** Rendered width of one wrapped line, including the spaces between its words. */
function lineWidth(line: LayoutWord[], spaceWidth: number): number {
  if (line.length === 0) return 0;
  return line.reduce((sum, word) => sum + word.wordWidth, 0) + spaceWidth * (line.length - 1);
}

interface PreparedHighlightScene {
  width: number;
  height: number;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  characterSpacing: number;
  lineHeight: number;
  lines: LayoutWord[][];
  layout: LineLayout;
  align: TextAlign;
  safeMargin: number;
  spaceWidth: number;
  blockCenterY: number;
  topPad: number;
  hookBoost: number;
}

function prepareHighlightScene(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  groups?: CaptionGroup[]
): PreparedHighlightScene | null {
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
  const padding = Math.min(CAPTION_SIDE_MARGIN_PX, width / 2);
  const maxWidth = Math.min(width - padding * 2, width * HIGHLIGHT_TEXT_WIDTH_RATIO);

  const preset = getCaptionStylePreset(style.captionStyleId);
  const chunkWords = style.chunkWords ?? preset.defaultChunkWords;
  const scene = buildCaptionScene(transcript, currentTime, chunkWords);
  if (scene.length === 0) return null;

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

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

  // Orphan control only where the study's fixed chunking is in play, so
  // karaoke-chip's long-standing wrap is untouched.
  const wrapLayout = layoutWrappedLines(measured, spaceWidth, maxWidth, {
    orphanMaxChars: chunkWords ? ORPHAN_MAX_CHARS : 0,
  });
  const lines = wrapLayout.lines;
  const blockHeight = lines.length * lineHeight;
  const topPad =
    resolveBlockTopForAlign(
      style.verticalAlign ?? DEFAULT_VERTICAL_ALIGN,
      height,
      blockHeight,
      preset.topRatio ?? HIGHLIGHT_TOP_RATIO
    ) ?? Math.max(height * CAPTION_VERTICAL_SAFE_RATIO, height * HIGHLIGHT_TOP_RATIO);
  const activeGroup = getActiveCaptionGroup(groups ?? [], currentTime);

  return {
    width,
    height,
    textColor,
    fontFamily,
    fontSize,
    characterSpacing,
    lineHeight,
    lines,
    layout: wrapLayout,
    align: style.textAlign ?? DEFAULT_TEXT_ALIGN,
    safeMargin: padding,
    spaceWidth,
    blockCenterY: topPad + blockHeight / 2,
    topPad,
    hookBoost: activeGroup?.role === 'hook' ? HOOK_SCALE_MULTIPLIER : 1,
  };
}

export function measureStaticHighlightCaptionBlock(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  groups?: CaptionGroup[]
): HighlightCaptionMetrics | null {
  const prep = prepareHighlightScene(ctx, currentTime, transcript, style, groups);
  if (!prep) return null;

  const { width, lines, layout, blockCenterY, lineHeight, hookBoost, align, safeMargin, spaceWidth } = prep;
  const scale = layout.scale * hookBoost;
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
 * Static-highlight mechanic: the whole line/block stays on screen and only
 * a chip background moves from word to word in sync with playback — no
 * word ever fades in/out. Used by the karaoke-chip caption style.
 */
export function drawStaticHighlightCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  captionTransform?: CaptionTransform,
  groups?: CaptionGroup[]
): void {
  if (captionTransform && !captionTransform.visible) return;

  const prep = prepareHighlightScene(ctx, currentTime, transcript, style, groups);
  if (!prep) return;

  const { width, height, textColor, fontFamily, fontSize, characterSpacing, lineHeight, lines, layout, align, safeMargin, spaceWidth, blockCenterY, topPad, hookBoost } = prep;
  const preset = getCaptionStylePreset(style.captionStyleId);
  const chipColor = preset.chipColor ?? '#22D3EE';
  const chipTextColor = preset.chipTextColor ?? '#111111';
  // A drop shadow behind idle words reads as a smudge on a light surface —
  // only styles that invert their chip (cream-block) sit on one.
  const idleWordShadow = preset.chipTextColor === undefined;

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const offsetX = (captionTransform?.offsetXRatio ?? 0) * width;
  const offsetY = (captionTransform?.offsetYRatio ?? 0) * height;
  const manualScale = Math.max(0.4, Math.min(3, captionTransform?.scale ?? 1));
  const rotationRad = ((captionTransform?.rotationDeg ?? 0) * Math.PI) / 180;
  const combinedScale = manualScale * layout.scale * hookBoost;
  const pivotX = resolveScalePivotX(align, width, safeMargin);

  ctx.save();
  ctx.translate(pivotX + offsetX, blockCenterY + offsetY);
  ctx.rotate(rotationRad);
  ctx.scale(combinedScale, combinedScale);
  ctx.translate(-pivotX, -blockCenterY);

  const chipPadX = fontSize * (preset.chipPaddingXRatio ?? CHIP_PADDING_X_RATIO);
  const chipPadY = fontSize * (preset.chipPaddingYRatio ?? CHIP_PADDING_Y_RATIO);
  const chipRadius = fontSize * (preset.chipRadiusRatio ?? CHIP_RADIUS_RATIO);

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lineY = topPad + li * lineHeight + lineHeight / 2;
    let x = resolveLineX(align, lineWidth(line, spaceWidth), width, safeMargin);

    for (const word of line) {
      const isActive = currentTime >= word.start && currentTime < word.end;
      const wordX = x;
      x += word.wordWidth + spaceWidth;

      ctx.save();
      if (isActive) {
        const chipX = wordX - chipPadX;
        const chipY = lineY - lineHeight / 2 + chipPadY / 2;
        const chipW = word.wordWidth + chipPadX * 2;
        const chipH = lineHeight - chipPadY;
        ctx.fillStyle = chipColor;
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(chipX, chipY, chipW, chipH, chipRadius);
          ctx.fill();
        } else {
          ctx.fillRect(chipX, chipY, chipW, chipH);
        }
        ctx.fillStyle = chipTextColor;
      } else {
        if (idleWordShadow) {
          ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
          ctx.shadowBlur = Math.max(6, fontSize * 0.08);
        }
        ctx.fillStyle = textColor;
      }
      drawSpacedText(ctx, word.text, wordX, lineY, { characterSpacing });
      ctx.restore();
    }
  }

  ctx.restore();
}
