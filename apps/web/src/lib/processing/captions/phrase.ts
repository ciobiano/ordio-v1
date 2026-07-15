import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type {
  CanvasLayout,
  CaptionAnimation,
  CaptionGroup,
  CaptionTransform,
} from '@/stores';
import { drawSpacedText, measureTextWidth } from '@/lib/video/textLayout';
import { wrapText } from './wrapText';
import {
  buildOneLinePhraseSegments,
  findActiveDisplaySegment,
} from '@/lib/captions/display';
import {
  calculatePhraseTextY,
  FONT_WEIGHT,
  getMaxCaptionTextWidth,
  hasPulse,
  PHRASE_FADE_DURATION,
  type PhraseCaptionMetrics,
} from './shared';

function getPhraseTransition(
  ctx: CanvasRenderingContext2D,
  transcript: Word[],
  currentTime: number,
  maxWidth: number,
  characterSpacing: number,
  groups?: CaptionGroup[]
): { currentText: string; prevText: string; progress: number; groupIndex: number } {
  if (groups && groups.length > 0) {
    const currentGroupIdx = groups.findIndex(
      (group) => currentTime >= group.start && currentTime < group.end
    );

    if (currentGroupIdx >= 0) {
      return {
        currentText: groups[currentGroupIdx].text,
        prevText: '',
        progress: 1,
        groupIndex: currentGroupIdx,
      };
    }

    const nextGroupIdx = groups.findIndex((group) => group.start > currentTime);
    if (nextGroupIdx > 0) {
      return {
        currentText: '',
        prevText: groups[nextGroupIdx - 1].text,
        progress: 1,
        groupIndex: -1,
      };
    }

    if (groups.length > 0 && currentTime >= groups[groups.length - 1].end) {
      return {
        currentText: '',
        prevText: groups[groups.length - 1].text,
        progress: 1,
        groupIndex: -1,
      };
    }

    return { currentText: '', prevText: '', progress: 1, groupIndex: -1 };
  }

  const segments = buildOneLinePhraseSegments(
    transcript,
    (text) => measureTextWidth(ctx, text, characterSpacing),
    maxWidth
  );
  const activeSegment = findActiveDisplaySegment(segments, currentTime);
  const currentIdx = activeSegment ? segments.indexOf(activeSegment) : -1;

  if (activeSegment && currentIdx >= 0) {
    const progress = Math.min(
      1,
      Math.max(0, (currentTime - activeSegment.start) / PHRASE_FADE_DURATION)
    );
    return {
      currentText: activeSegment.text,
      prevText: progress < 1 && currentIdx > 0 ? segments[currentIdx - 1].text : '',
      progress,
      groupIndex: currentIdx,
    };
  }

  if (transcript.length > 0 && currentTime >= transcript[transcript.length - 1].end) {
    const last = segments[segments.length - 1];
    return {
      currentText: '',
      prevText: last?.text ?? '',
      progress: 1,
      groupIndex: -1,
    };
  }

  return { currentText: '', prevText: '', progress: 1, groupIndex: -1 };
}

/**
 * Lays out a phrase caption at a FIXED font size, wrapping into lines instead
 * of shrinking to fit the canvas width. Font size stays constant across short
 * and long groups — a two-word phrase and a four-line sentence render at the
 * same scale, so the video doesn't pump between tiny and huge text.
 * `fitScale` only drops below 1 for a single unbreakable over-wide word.
 */
function layoutPhraseLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: StyleConfig
): { lines: string[]; blockWidth: number; blockHeight: number; lineHeight: number; fitScale: number } {
  const maxTextWidth = getMaxCaptionTextWidth(style.width);
  const characterSpacing = style.characterSpacing ?? 0;
  const lineHeight = style.fontSize * (style.lineHeight ?? 1.4);
  const lines = wrapText(ctx, text, maxTextWidth, characterSpacing);
  const blockWidth = Math.max(
    0,
    ...lines.map((line) => measureTextWidth(ctx, line, characterSpacing))
  );
  const blockHeight = Math.max(lineHeight, lines.length * lineHeight);

  return {
    lines,
    blockWidth,
    blockHeight,
    lineHeight,
    fitScale: blockWidth > 0 ? Math.min(1, maxTextWidth / blockWidth) : 1,
  };
}

export function drawCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  flipped = false,
  groups?: CaptionGroup[],
  animation: CaptionAnimation = 'sweep-pulse',
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
  } = style;

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';

  const maxTextWidth = getMaxCaptionTextWidth(width);
  const transition = getPhraseTransition(
    ctx,
    transcript,
    currentTime,
    maxTextWidth,
    characterSpacing,
    groups
  );
  if (!transition.currentText && !transition.prevText) return;

  const text = transition.currentText || transition.prevText;

  ctx.textAlign = 'center';
  const centerX = width / 2;
  const pulseScale = hasPulse(animation)
    ? 1 + 0.035 * Math.sin(Math.min(1, transition.progress) * Math.PI)
    : 1;

  const renderText = (textToRender: string, alpha: number) => {
    const { lines, blockWidth, blockHeight, lineHeight, fitScale } = layoutPhraseLines(
      ctx,
      textToRender,
      style
    );
    const textY = calculatePhraseTextY(height, layout, hasVisualZone, flipped, blockHeight);
    // Even mid-pulse, the widest line must stay inside the safe width.
    const maxScaleForWidth = blockWidth > 0 ? maxTextWidth / blockWidth : 1;
    const constrainedScale = Math.min(fitScale * pulseScale, maxScaleForWidth);

    ctx.save();
    ctx.globalAlpha = alpha;
    const blockCenterY = textY + blockHeight / 2;
    const offsetX = (captionTransform?.offsetXRatio ?? 0) * width;
    const offsetY = (captionTransform?.offsetYRatio ?? 0) * height;
    const manualScale = Math.max(0.4, Math.min(3, captionTransform?.scale ?? 1));
    const rotationRad = ((captionTransform?.rotationDeg ?? 0) * Math.PI) / 180;
    ctx.translate(centerX + offsetX, blockCenterY + offsetY);
    ctx.rotate(rotationRad);
    ctx.scale(constrainedScale * manualScale, constrainedScale * manualScale);
    ctx.translate(-centerX, -blockCenterY);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = Math.max(8, fontSize * 0.12);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.25, fontSize * 0.022);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    lines.forEach((line, i) => {
      const lineY = textY + (i + 0.5) * lineHeight;
      drawSpacedText(ctx, line, centerX, lineY, {
        textAlign: 'center',
        mode: 'stroke',
        characterSpacing,
      });
      ctx.fillStyle = textColor;
      drawSpacedText(ctx, line, centerX, lineY, {
        textAlign: 'center',
        mode: 'fill',
        characterSpacing,
      });
    });
    ctx.restore();
  };

  if (transition.prevText && transition.progress < 1) {
    renderText(transition.prevText, 1 - transition.progress);
  }

  renderText(text, transition.progress);
}

export function measureActivePhraseCaption(
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

  ctx.font = `${FONT_WEIGHT} ${style.fontSize}px "${style.fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';

  const maxTextWidth = getMaxCaptionTextWidth(style.width);
  const characterSpacing = style.characterSpacing ?? 0;
  const transition = getPhraseTransition(
    ctx,
    transcript,
    currentTime,
    maxTextWidth,
    characterSpacing,
    groups
  );
  const text = transition.currentText || transition.prevText;
  if (!text) return null;

  const { lines, blockWidth, blockHeight, lineHeight, fitScale } = layoutPhraseLines(
    ctx,
    text,
    style
  );
  const textY = calculatePhraseTextY(style.height, layout, hasVisualZone, flipped, blockHeight);

  return {
    text,
    lines,
    centerX: style.width / 2,
    textY,
    lineHeight,
    blockWidth,
    blockHeight,
    blockCenterY: textY + blockHeight / 2,
    fitScale,
  };
}
