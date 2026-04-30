import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CanvasLayout, CaptionAnimation, CaptionGroup, CaptionTransform } from '@/stores';
import { buildSmartSegments, findActiveSegmentIndex } from '@/lib/captions/segmentation';
import { drawSpacedText, measureTextWidth } from '@/lib/video/textLayout';
import {
  WAVEFORM_CENTER_Y,
  WAVEFORM_CENTER_Y_FLIPPED,
  WAVEFORM_MAX_AMP,
  GAP_ABOVE_WAVEFORM,
} from '@/lib/waveforms/constants';

const CAPTION_PADDING = 0.08;
const FONT_WEIGHT = '600';
const MIN_CAPTION_SAFE_ZONE = 0.02;
const PHRASE_FADE_DURATION = 0.15;
const PHRASE_TOP_RATIO = 0.18;
const PHRASE_TOP_WITH_VISUAL_RATIO = 0.14;

function hasPulse(animation: CaptionAnimation): boolean {
  return animation === 'pulse' || animation === 'sweep-pulse';
}
function getPhraseTransition(
  transcript: Word[],
  currentTime: number,
  groups?: CaptionGroup[] | undefined
): { currentText: string; prevText: string; progress: number; groupIndex: number } {
  // If we have custom groups, use them (no fading, instant cut)
  if (groups && groups.length > 0) {
    const currentGroupIdx = groups.findIndex(
      g => currentTime >= g.start && currentTime < g.end
    );
    
    if (currentGroupIdx >= 0) {
      return { 
        currentText: groups[currentGroupIdx].text, 
        prevText: '', 
        progress: 1, 
        groupIndex: currentGroupIdx 
      };
    }
    
    // Find next upcoming group if we are in a gap
    const nextGroupIdx = groups.findIndex(g => g.start > currentTime);
    if (nextGroupIdx > 0) {
      return { 
        currentText: '', 
        prevText: groups[nextGroupIdx - 1].text, 
        progress: 1, 
        groupIndex: -1 
      };
    }
    
    // Past all groups
    if (groups.length > 0 && currentTime >= groups[groups.length - 1].end) {
      return {
        currentText: '',
        prevText: groups[groups.length - 1].text,
        progress: 1,
        groupIndex: -1
      };
    }

    return { currentText: '', prevText: '', progress: 1, groupIndex: -1 };
  }
  
  // Fallback: smart segmentation (pause + punctuation + readability limits)
  const segments = buildSmartSegments(transcript);
  const currentIdx = findActiveSegmentIndex(segments, currentTime);
  
  if (currentIdx >= 0) {
    const segment = segments[currentIdx];
    const text = segment.text;
    
    // Calculate pure time-based fade
    const firstWordStart = segment.start;
    const timeSinceStart = currentTime - firstWordStart;
    const progress = Math.min(1, Math.max(0, timeSinceStart / PHRASE_FADE_DURATION));
    
    let prevText = '';
    if (progress < 1 && currentIdx > 0) {
      prevText = segments[currentIdx - 1].text;
    }
    
    return { currentText: text, prevText, progress, groupIndex: currentIdx };
  }

  // Find the last active segment if we are past the end
  if (transcript.length > 0 && currentTime >= transcript[transcript.length - 1].end) {
    const last = segments[segments.length - 1];
    return { currentText: '', prevText: last?.text ?? '', progress: 1, groupIndex: -1 };
  }

  return { currentText: '', prevText: '', progress: 1, groupIndex: -1 };
}

export function drawCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  flipped = false,
  groups?: CaptionGroup[] | undefined,
  animation: CaptionAnimation = 'sweep-pulse',
  captionTransform?: CaptionTransform
): void {
  if (transcript.length === 0) return;
  if (captionTransform && !captionTransform.visible) return;

  const { width, height, textColor, fontFamily, fontSize, characterSpacing = 0, lineHeight: lineHeightMultiplier = 1.4 } = style;
  const padding = width * CAPTION_PADDING;

  const transition = getPhraseTransition(transcript, currentTime, groups);
  if (!transition.currentText && !transition.prevText) return;

  const text = transition.currentText || transition.prevText;

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';

  const maxTextWidth = width - padding * 2;
  const lineHeight = fontSize * lineHeightMultiplier;
  const totalHeight = lineHeight;
  const safePad = height * CAPTION_PADDING;

  let textY: number;
  if (!hasVisualZone) {
    textY = Math.max(safePad, height * PHRASE_TOP_RATIO);
  } else if (!flipped) {
    const waveformTop = height * WAVEFORM_CENTER_Y - height * WAVEFORM_MAX_AMP;
    const minSafeZone = height * MIN_CAPTION_SAFE_ZONE;
    const captionBottom = waveformTop - height * GAP_ABOVE_WAVEFORM;
    const maxTextY = captionBottom - minSafeZone - totalHeight;
    if (layout === 'top') {
      textY = Math.min(height * PHRASE_TOP_WITH_VISUAL_RATIO, maxTextY);
    } else if (layout === 'compact') {
      textY = Math.min(height * (PHRASE_TOP_WITH_VISUAL_RATIO + 0.04), maxTextY);
    } else {
      textY = Math.min(height * 0.2, maxTextY);
    }
    textY = Math.max(textY, safePad);
  } else {
    const waveformBottom = WAVEFORM_CENTER_Y_FLIPPED * height + height * WAVEFORM_MAX_AMP;
    const captionTop = waveformBottom + height * GAP_ABOVE_WAVEFORM;
    const captionBottom = height - safePad;
    const minTextY = captionTop;
    textY =
      layout === 'compact'
        ? minTextY
        : Math.max(minTextY, captionTop + (captionBottom - captionTop - totalHeight) / 2);
    textY = Math.min(textY, captionBottom - totalHeight);
  }

  ctx.textAlign = 'center';
  const centerX = width / 2;

  const pulseEnabled = hasPulse(animation);
  const pulseScale = pulseEnabled
    ? 1 + 0.035 * Math.sin(Math.min(1, transition.progress) * Math.PI)
    : 1;

  const renderText = (lineToRender: string, alpha: number) => {
    const measuredWidth = measureTextWidth(ctx, lineToRender, characterSpacing);
    const fitScale = measuredWidth > 0 ? Math.min(1, maxTextWidth / measuredWidth) : 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    const blockCenterY = textY + totalHeight / 2;
    const offsetX = (captionTransform?.offsetXRatio ?? 0) * width;
    const offsetY = (captionTransform?.offsetYRatio ?? 0) * height;
    const centerTX = centerX + offsetX;
    const centerTY = blockCenterY + offsetY;
    const manualScale = Math.max(0.4, Math.min(3, captionTransform?.scale ?? 1));
    const rotationRad = ((captionTransform?.rotationDeg ?? 0) * Math.PI) / 180;
    ctx.translate(centerTX, centerTY);
    ctx.rotate(rotationRad);
    ctx.scale(fitScale * pulseScale * manualScale, fitScale * pulseScale * manualScale);
    ctx.translate(-centerX, -blockCenterY);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
    ctx.shadowBlur = Math.max(8, fontSize * 0.12);
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.25, fontSize * 0.022);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    drawSpacedText(ctx, lineToRender, centerX, textY + lineHeight / 2, {
      textAlign: 'center',
      mode: 'stroke',
      characterSpacing,
    });
    ctx.fillStyle = textColor;
    drawSpacedText(ctx, lineToRender, centerX, textY + lineHeight / 2, {
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

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  if (words.length <= 1) return words;

  const n = words.length;
  const startsWithWeakWord = (line: string) => /^(and|or|but|to|of|the|a|an)\b/i.test(line);
  const cache = new Map<string, number>();
  const lineText = (i: number, j: number): string => words.slice(i, j).join(' ');
  const lineWidth = (i: number, j: number): number => {
    const key = `${i}:${j}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const width = measureTextWidth(ctx, lineText(i, j), 0);
    cache.set(key, width);
    return width;
  };

  const dp = new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY);
  const nextBreak = new Array<number>(n + 1).fill(-1);
  dp[n] = 0;

  for (let i = n - 1; i >= 0; i--) {
    for (let j = i + 1; j <= n; j++) {
      const width = lineWidth(i, j);
      if (width > maxWidth) break;

      let cost = Math.pow((maxWidth - width) / Math.max(1, maxWidth), 2);
      const wordsInLine = j - i;

      if (wordsInLine === 1 && n > 2) cost += 10;
      if (startsWithWeakWord(lineText(i, j))) cost += 2;
      if (j !== n) cost += 0.15; // prefer fewer lines when quality is similar

      const total = cost + dp[j];
      if (total < dp[i]) {
        dp[i] = total;
        nextBreak[i] = j;
      }
    }
  }

  if (nextBreak[0] === -1) return [text];

  const lines: string[] = [];
  let i = 0;
  while (i < n && nextBreak[i] > i) {
    const j = nextBreak[i];
    lines.push(lineText(i, j));
    i = j;
  }

  return lines.length > 0 ? lines : [text];
}
