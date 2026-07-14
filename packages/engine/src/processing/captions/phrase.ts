import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type {
  CanvasLayout,
  CaptionAnimation,
  CaptionGroup,
  CaptionTransform,
} from '@/stores';
import { drawSpacedText, measureTextWidth } from '@/lib/video/textLayout';
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

function measurePhraseCaptionText(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: StyleConfig,
  textY: number
): PhraseCaptionMetrics {
  const maxTextWidth = getMaxCaptionTextWidth(style.width);
  const characterSpacing = style.characterSpacing ?? 0;
  const lineHeight = style.fontSize * (style.lineHeight ?? 1.4);
  const lines = [text];
  const blockWidth = Math.max(
    0,
    ...lines.map((line) => measureTextWidth(ctx, line, characterSpacing))
  );
  const blockHeight = Math.max(lineHeight, lines.length * lineHeight);

  return {
    text,
    lines,
    centerX: style.width / 2,
    textY,
    lineHeight,
    blockWidth,
    blockHeight,
    blockCenterY: textY + blockHeight / 2,
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
    lineHeight: lineHeightMultiplier = 1.4,
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
  const lineHeight = fontSize * lineHeightMultiplier;
  const textY = calculatePhraseTextY(
    height,
    layout,
    hasVisualZone,
    flipped,
    Math.max(lineHeight, lineHeight)
  );

  ctx.textAlign = 'center';
  const centerX = width / 2;
  const pulseScale = hasPulse(animation)
    ? 1 + 0.035 * Math.sin(Math.min(1, transition.progress) * Math.PI)
    : 1;

  const renderText = (lineToRender: string, alpha: number) => {
    const measuredWidth = measureTextWidth(ctx, lineToRender, characterSpacing);
    const maxScaleForWidth = measuredWidth > 0 ? maxTextWidth / measuredWidth : 1;
    const fitScale = Math.min(1, maxScaleForWidth);
    const constrainedScale = Math.min(fitScale * pulseScale, maxScaleForWidth);
    const blockHeight = lineHeight;

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
    const lineY = textY + lineHeight / 2;
    drawSpacedText(ctx, lineToRender, centerX, lineY, {
      textAlign: 'center',
      mode: 'stroke',
      characterSpacing,
    });
    ctx.fillStyle = textColor;
    drawSpacedText(ctx, lineToRender, centerX, lineY, {
      textAlign: 'center',
      mode: 'fill',
      characterSpacing,
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

  const lineHeight = style.fontSize * (style.lineHeight ?? 1.4);
  const blockHeight = Math.max(lineHeight, lineHeight);
  const textY = calculatePhraseTextY(style.height, layout, hasVisualZone, flipped, blockHeight);

  return measurePhraseCaptionText(ctx, text, style, textY);
}
