import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CanvasLayout, CaptionGroup, CaptionTransform } from '../../types';
import { drawSpacedText, measureTextWidth } from '../../video/textLayout';
import {
  buildOneLinePhraseSegments,
  findActiveDisplaySegment,
} from '../../captions/display';
import {
  FONT_WEIGHT,
  getSpotlightCenterY,
  SPOTLIGHT_WIDTH_RATIO,
  SUPPORTING_ALPHA,
  SUPPORTING_SCALE,
  type SpotlightCaptionMetrics,
} from './shared';

function getSpotlightSegments(
  ctx: CanvasRenderingContext2D,
  transcript: Word[],
  currentTime: number,
  maxWidth: number,
  characterSpacing: number,
  groups?: CaptionGroup[]
): { segments: Array<{ text: string; start: number; end: number }>; activeIndex: number } {
  if (groups && groups.length > 0) {
    return {
      segments: groups.map((group) => ({ text: group.text, start: group.start, end: group.end })),
      activeIndex: groups.findIndex((group) => currentTime >= group.start && currentTime < group.end),
    };
  }

  const segments = buildOneLinePhraseSegments(
    transcript,
    (text) => measureTextWidth(ctx, text, characterSpacing),
    maxWidth
  );
  const activeSegment = findActiveDisplaySegment(segments, currentTime);
  return {
    segments,
    activeIndex: activeSegment ? segments.indexOf(activeSegment) : -1,
  };
}

function getSpotlightRows(
  segments: Array<{ text: string }>,
  activeIndex: number,
  lineHeight: number
): Array<{ text: string; offset: number; alpha: number; scale: number }> {
  if (activeIndex < 0 || activeIndex >= segments.length) return [];

  return [
    {
      text: segments[activeIndex - 1]?.text,
      offset: -lineHeight,
      alpha: SUPPORTING_ALPHA,
      scale: SUPPORTING_SCALE,
    },
    { text: segments[activeIndex].text, offset: 0, alpha: 1, scale: 1 },
    {
      text: segments[activeIndex + 1]?.text,
      offset: lineHeight,
      alpha: SUPPORTING_ALPHA,
      scale: SUPPORTING_SCALE,
    },
  ].filter(
    (row): row is { text: string; offset: number; alpha: number; scale: number } =>
      Boolean(row.text)
  );
}

export function drawSpotlightCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  groups?: CaptionGroup[],
  captionTransform?: CaptionTransform
): void {
  if (transcript.length === 0) return;
  if (captionTransform && !captionTransform.visible) return;

  const {
    width,
    height,
    textColor,
    fontFamily,
    fontSize,
    characterSpacing = 0,
    lineHeight: lineHeightMultiplier = 1.4,
  } = style;
  const maxWidth = width * SPOTLIGHT_WIDTH_RATIO;

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const lineHeight = fontSize * lineHeightMultiplier;
  const { segments, activeIndex } = getSpotlightSegments(
    ctx,
    transcript,
    currentTime,
    maxWidth,
    characterSpacing,
    groups
  );
  const rows = getSpotlightRows(segments, activeIndex, lineHeight);
  if (rows.length === 0) return;

  const centerX = width / 2 + (captionTransform?.offsetXRatio ?? 0) * width;
  const centerY =
    getSpotlightCenterY(height, lineHeight, layout, hasVisualZone) +
    (captionTransform?.offsetYRatio ?? 0) * height;
  const manualScale = Math.max(0.4, Math.min(3, captionTransform?.scale ?? 1));
  const rotationRad = ((captionTransform?.rotationDeg ?? 0) * Math.PI) / 180;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotationRad);
  ctx.scale(manualScale, manualScale);
  ctx.translate(-width / 2, 0);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.24)';
  ctx.shadowBlur = Math.max(8, fontSize * 0.12);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.25, fontSize * 0.022);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';

  rows.forEach((row) => {
    const rowMeasuredWidth = measureTextWidth(ctx, row.text, characterSpacing);
    const rowFitScale = rowMeasuredWidth > 0 ? Math.min(1, maxWidth / rowMeasuredWidth) : 1;
    const rowScale = row.scale * rowFitScale;
    ctx.save();
    ctx.translate(width / 2, row.offset);
    ctx.scale(rowScale, rowScale);
    ctx.translate(-width / 2, 0);
    ctx.globalAlpha = row.alpha;
    drawSpacedText(ctx, row.text, width / 2, 0, {
      textAlign: 'center',
      mode: 'stroke',
      characterSpacing,
    });
    ctx.fillStyle = textColor;
    drawSpacedText(ctx, row.text, width / 2, 0, {
      textAlign: 'center',
      mode: 'fill',
      characterSpacing,
    });
    ctx.restore();
  });

  ctx.restore();
  ctx.globalAlpha = 1;
}

export function measureSpotlightCaptionBlock(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  groups?: CaptionGroup[]
): SpotlightCaptionMetrics | null {
  if (transcript.length === 0) return null;

  const {
    width,
    height,
    fontFamily,
    fontSize,
    characterSpacing = 0,
    lineHeight: lineHeightMultiplier = 1.4,
  } = style;
  const maxWidth = width * SPOTLIGHT_WIDTH_RATIO;

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';

  const lineHeight = fontSize * lineHeightMultiplier;
  const { segments, activeIndex } = getSpotlightSegments(
    ctx,
    transcript,
    currentTime,
    maxWidth,
    characterSpacing,
    groups
  );
  const rows = getSpotlightRows(segments, activeIndex, lineHeight);
  if (rows.length === 0) return null;

  const centerX = width / 2;
  const centerY = getSpotlightCenterY(height, lineHeight, layout, hasVisualZone);
  const extents = rows.map((row) => {
    const rowMeasuredWidth = measureTextWidth(ctx, row.text, characterSpacing);
    const rowFitScale = rowMeasuredWidth > 0 ? Math.min(1, maxWidth / rowMeasuredWidth) : 1;
    const rowScale = row.scale * rowFitScale;
    const rowHeight = lineHeight * rowScale;
    const rowWidth = rowMeasuredWidth * rowScale;
    return {
      top: row.offset - rowHeight / 2,
      bottom: row.offset + rowHeight / 2,
      width: rowWidth,
    };
  });

  const top = Math.min(...extents.map((extent) => extent.top));
  const bottom = Math.max(...extents.map((extent) => extent.bottom));

  return {
    centerX,
    centerY,
    blockCenterY: centerY + (top + bottom) / 2,
    blockWidth: Math.max(...extents.map((extent) => extent.width)),
    blockHeight: bottom - top,
  };
}
