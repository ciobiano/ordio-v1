import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionTransform } from '../../types';
import { drawSpacedText, measureTextWidth } from '../../video/textLayout';
import { getCaptionStylePreset } from '../../captions/presets';
import { buildSentenceSegments, findActiveDisplaySegment } from '../../captions/display';
import {
  CAPTION_VERTICAL_SAFE_RATIO,
  CHIP_PADDING_X_RATIO,
  CHIP_PADDING_Y_RATIO,
  CHIP_RADIUS_RATIO,
  FONT_WEIGHT,
  HIGHLIGHT_LINE_HEIGHT_RATIO,
  HIGHLIGHT_TEXT_WIDTH_RATIO,
  HIGHLIGHT_TOP_RATIO,
  layoutWrappedLines,
  type HighlightCaptionMetrics,
  type LayoutWord,
  type LineLayout,
} from './shared';

const CAPTION_SIDE_MARGIN_PX = 2;

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
  blockLeft: number;
  blockCenterY: number;
  topPad: number;
}

function prepareHighlightScene(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig
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

  const scene = findActiveDisplaySegment(buildSentenceSegments(transcript), currentTime)?.words ?? [];
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

  const wrapLayout = layoutWrappedLines(measured, spaceWidth, maxWidth);
  const lines = wrapLayout.lines;
  const blockLeft = Math.max(padding, (width - wrapLayout.logicalMaxWidth) / 2);
  const topPad = Math.max(height * CAPTION_VERTICAL_SAFE_RATIO, height * HIGHLIGHT_TOP_RATIO);
  const blockHeight = lines.length * lineHeight;

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
    blockLeft,
    blockCenterY: topPad + blockHeight / 2,
    topPad,
  };
}

export function measureStaticHighlightCaptionBlock(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig
): HighlightCaptionMetrics | null {
  const prep = prepareHighlightScene(ctx, currentTime, transcript, style);
  if (!prep) return null;

  const { width, lines, layout, blockCenterY, lineHeight } = prep;
  return {
    centerX: width / 2,
    blockCenterY,
    blockWidth: layout.logicalMaxWidth * layout.scale,
    blockHeight: lines.length * lineHeight * layout.scale,
    layoutScale: layout.scale,
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
  captionTransform?: CaptionTransform
): void {
  if (captionTransform && !captionTransform.visible) return;

  const prep = prepareHighlightScene(ctx, currentTime, transcript, style);
  if (!prep) return;

  const { width, height, textColor, fontFamily, fontSize, characterSpacing, lineHeight, lines, layout, blockLeft, blockCenterY, topPad } = prep;
  const preset = getCaptionStylePreset(style.captionStyleId);
  const chipColor = preset.chipColor ?? '#22D3EE';

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const offsetX = (captionTransform?.offsetXRatio ?? 0) * width;
  const offsetY = (captionTransform?.offsetYRatio ?? 0) * height;
  const centerTX = width / 2 + offsetX;
  const centerTY = blockCenterY + offsetY;
  const manualScale = Math.max(0.4, Math.min(3, captionTransform?.scale ?? 1));
  const rotationRad = ((captionTransform?.rotationDeg ?? 0) * Math.PI) / 180;
  const combinedScale = manualScale * layout.scale;

  ctx.save();
  ctx.translate(centerTX, centerTY);
  ctx.rotate(rotationRad);
  ctx.scale(combinedScale, combinedScale);
  ctx.translate(-width / 2, -blockCenterY);

  const spaceW = measureTextWidth(ctx, ' ', characterSpacing);
  const chipPadX = fontSize * CHIP_PADDING_X_RATIO;
  const chipPadY = fontSize * CHIP_PADDING_Y_RATIO;
  const chipRadius = fontSize * CHIP_RADIUS_RATIO;

  for (let li = 0; li < lines.length; li++) {
    const lineY = topPad + li * lineHeight + lineHeight / 2;
    let x = blockLeft;

    for (const word of lines[li]) {
      const isActive = currentTime >= word.start && currentTime < word.end;
      const wordX = x;
      x += word.wordWidth + spaceW;

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
        ctx.fillStyle = '#111111';
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = Math.max(6, fontSize * 0.08);
        ctx.fillStyle = textColor;
      }
      drawSpacedText(ctx, word.text, wordX, lineY, { characterSpacing });
      ctx.restore();
    }
  }

  ctx.restore();
}
