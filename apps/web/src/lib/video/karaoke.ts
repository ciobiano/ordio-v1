import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionAnimation, CaptionGroup, CaptionTransform } from '@/stores';
import {
  buildSentenceSegments,
  findActiveDisplaySegment,
} from '@/lib/captions/display';
import { drawSpacedText, measureTextWidth } from './textLayout';

const CAPTION_SIDE_MARGIN_PX = 2;
const CAPTION_VERTICAL_SAFE_RATIO = 0.08;
const FONT_WEIGHT = '600';
const KARAOKE_MAX_LINES = 4;
const KARAOKE_MIN_SCALE = 0.7;
const KARAOKE_MIN_WORDS_PER_LINE = 3;
const KARAOKE_PAGE_FADE_DURATION = 0.12;
const KARAOKE_INACTIVE_ALPHA = 0.62;
const KARAOKE_COMPLETE_ALPHA = 1;
const KARAOKE_LINE_PAUSE_BREAK = 0.24;
const KARAOKE_TEXT_WIDTH_RATIO = 0.84;
const KARAOKE_TOP_RATIO = 0.15;
const SCALE_CANDIDATES = [1, 0.94, 0.88, 0.82, 0.76, KARAOKE_MIN_SCALE];

/** Blend caption color toward background — higher = closer to surface (more “disabled”). */
const KARAOKE_DIM_UPCOMING_T = 0.74;
/** Completed-but-not-current: keep closer to caption color than upcoming (less blend toward bg). */
const KARAOKE_DIM_COMPLETE_T = 0.32;

const FALLBACK_UPCOMING = 'rgb(58, 58, 62)';
const FALLBACK_COMPLETE = 'rgb(88, 88, 94)';

function parseHex6Rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(
  from: [number, number, number],
  toward: [number, number, number],
  t: number
): string {
  const u = Math.min(1, Math.max(0, t));
  const r = Math.round(from[0] + (toward[0] - from[0]) * u);
  const g = Math.round(from[1] + (toward[1] - from[1]) * u);
  const b = Math.round(from[2] + (toward[2] - from[2]) * u);
  return `rgb(${r},${g},${b})`;
}

/** Non-active karaoke fills: blend caption textColor toward backgroundColor for contrast on any canvas. */
export function karaokeNonActiveFills(style: Pick<StyleConfig, 'textColor' | 'backgroundColor'>): {
  upcoming: string;
  complete: string;
} {
  const text = parseHex6Rgb(style.textColor);
  const bg = parseHex6Rgb(style.backgroundColor);
  if (!text || !bg) {
    return { upcoming: FALLBACK_UPCOMING, complete: FALLBACK_COMPLETE };
  }
  return {
    upcoming: mixRgb(text, bg, KARAOKE_DIM_UPCOMING_T),
    complete: mixRgb(text, bg, KARAOKE_DIM_COMPLETE_T),
  };
}

/** Damped spring ease — fast entry with a small overshoot, settles quickly. */
function springEase(t: number): number {
  return 1 - Math.exp(-8 * t) * Math.cos(12 * t);
}

type KaraokeWord = { text: string; start: number; end: number; wordWidth: number; pauseToNext: number };
type KaraokeLineLayout = { lines: KaraokeWord[][]; scale: number; logicalMaxWidth: number };

function buildKaraokeLines(
  words: KaraokeWord[],
  spaceWidth: number,
  maxWidth: number
): KaraokeWord[][] {
  const lines: KaraokeWord[][] = [];
  let line: KaraokeWord[] = [];
  let lineWidth = 0;

  for (const word of words) {
    const needed = line.length === 0 ? word.wordWidth : lineWidth + spaceWidth + word.wordWidth;
    const prevPauseToNext = line.length > 0 ? line[line.length - 1].pauseToNext : 0;
    const prevHasNaturalPause = prevPauseToNext >= KARAOKE_LINE_PAUSE_BREAK;
    const widthOverflow = line.length >= KARAOKE_MIN_WORDS_PER_LINE && needed > maxWidth;

    if (line.length > 0 && (prevHasNaturalPause || widthOverflow)) {
      lines.push(line);
      line = [word];
      lineWidth = word.wordWidth;
    } else {
      line.push(word);
      lineWidth = needed;
    }
  }
  if (line.length > 0) lines.push(line);

  return lines;
}

function lineWidth(words: KaraokeWord[], spaceWidth: number): number {
  if (words.length === 0) return 0;
  return words.reduce((sum, word) => sum + word.wordWidth, 0) + spaceWidth * (words.length - 1);
}

function packWordsIntoLineCount(words: KaraokeWord[], maxLines: number): KaraokeWord[][] {
  const lines: KaraokeWord[][] = [];
  const wordsPerLine = Math.ceil(words.length / maxLines);

  for (let index = 0; index < words.length; index += wordsPerLine) {
    lines.push(words.slice(index, index + wordsPerLine));
  }

  return lines.slice(0, maxLines);
}

function layoutSentenceLines(
  words: KaraokeWord[],
  spaceWidth: number,
  maxWidth: number
): KaraokeLineLayout {
  for (const scale of SCALE_CANDIDATES) {
    const logicalMaxWidth = maxWidth / scale;
    const lines = buildKaraokeLines(words, spaceWidth, logicalMaxWidth);
    if (lines.length <= KARAOKE_MAX_LINES) {
      return { lines, scale, logicalMaxWidth };
    }
  }

  const lines = packWordsIntoLineCount(words, KARAOKE_MAX_LINES);
  const widestLine = Math.max(1, ...lines.map((line) => lineWidth(line, spaceWidth)));
  const scale = Math.max(KARAOKE_MIN_SCALE, Math.min(1, maxWidth / widestLine));

  return {
    lines,
    scale,
    logicalMaxWidth: maxWidth / scale,
  };
}

function hasSweep(animation: CaptionAnimation): boolean {
  return animation === 'sweep' || animation === 'sweep-pulse';
}

function hasPulse(animation: CaptionAnimation): boolean {
  return animation === 'pulse' || animation === 'sweep-pulse';
}

export interface KaraokeCaptionBlockMetrics {
  centerX: number;
  blockCenterY: number;
  blockWidth: number;
  blockHeight: number;
  layoutScale: number;
}

interface PreparedKaraokeScene {
  width: number;
  height: number;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  characterSpacing: number;
  lineHeight: number;
  pageLines: KaraokeWord[][];
  pageLayout: KaraokeLineLayout;
  blockLeft: number;
  blockCenterY: number;
  topPad: number;
  pageFade: number;
  animation: CaptionAnimation;
}

function prepareKaraokeScene(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  _groups?: CaptionGroup[],
  animation: CaptionAnimation = 'sweep-pulse'
): PreparedKaraokeScene | null {
  if (transcript.length === 0) return null;

  const { width, height, textColor, fontFamily, fontSize, characterSpacing = 0, lineHeight: lineHeightMultiplier = 1.4 } = style;
  const padding = Math.min(CAPTION_SIDE_MARGIN_PX, width / 2);
  const blockWidth = Math.min(width - padding * 2, width * KARAOKE_TEXT_WIDTH_RATIO);
  const maxWidth = blockWidth;
  const scene = findActiveDisplaySegment(buildSentenceSegments(transcript), currentTime)?.words ?? [];
  if (scene.length === 0) return null;

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const spaceWidth = measureTextWidth(ctx, ' ', characterSpacing);
  const lineHeight = fontSize * lineHeightMultiplier;

  const measured: KaraokeWord[] = scene.map((w) => ({
    text: w.text,
    start: w.start,
    end: w.end,
    wordWidth: measureTextWidth(ctx, w.text, characterSpacing),
    pauseToNext: 0,
  }));
  for (let i = 0; i < measured.length - 1; i++) {
    measured[i].pauseToNext = Math.max(0, measured[i + 1].start - measured[i].end);
  }

  const pageLayout = layoutSentenceLines(measured, spaceWidth, maxWidth);
  const pageLines = pageLayout.lines;
  const blockLeft = Math.max(padding, (width - pageLayout.logicalMaxWidth) / 2);

  const pageFirstWordStart = pageLines[0]?.[0]?.start ?? currentTime;
  const timeSincePageStart = Math.max(0, currentTime - pageFirstWordStart);
  const pageFade = Math.min(1, timeSincePageStart / KARAOKE_PAGE_FADE_DURATION);

  const topPad = Math.max(height * CAPTION_VERTICAL_SAFE_RATIO, height * KARAOKE_TOP_RATIO);
  const blockHeight = pageLines.length * lineHeight;
  const blockCenterY = topPad + blockHeight / 2;

  return {
    width,
    height,
    textColor,
    fontFamily,
    fontSize,
    characterSpacing,
    lineHeight,
    pageLines,
    pageLayout,
    blockLeft,
    blockCenterY,
    topPad,
    pageFade,
    animation,
  };
}

/**
 * Bounding metrics for the karaoke block (same layout as {@link drawKaraokeCaptions}).
 * Used by the canvas transform overlay in karaoke mode.
 */
export function measureKaraokeCaptionBlock(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  groups?: CaptionGroup[] | undefined
): KaraokeCaptionBlockMetrics | null {
  const prep = prepareKaraokeScene(ctx, currentTime, transcript, style, groups, 'sweep-pulse');
  if (!prep) return null;

  const { width, pageLines, pageLayout, blockCenterY, lineHeight } = prep;
  const layoutScale = pageLayout.scale;
  const blockWidth = pageLayout.logicalMaxWidth * layoutScale;
  const blockHeight = pageLines.length * lineHeight * layoutScale;

  return {
    centerX: width / 2,
    blockCenterY,
    blockWidth,
    blockHeight,
    layoutScale,
  };
}

export function drawKaraokeCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  groups?: CaptionGroup[],
  animation: CaptionAnimation = 'sweep-pulse',
  captionTransform?: CaptionTransform
): void {
  if (captionTransform && !captionTransform.visible) return;

  const prep = prepareKaraokeScene(ctx, currentTime, transcript, style, groups, animation);
  if (!prep) return;

  const {
    width,
    height,
    textColor,
    fontFamily,
    fontSize,
    characterSpacing,
    lineHeight,
    pageLines,
    pageLayout,
    blockLeft,
    blockCenterY,
    topPad,
    pageFade,
    animation: anim,
  } = prep;

  ctx.font = `${FONT_WEIGHT} ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const offsetX = (captionTransform?.offsetXRatio ?? 0) * width;
  const offsetY = (captionTransform?.offsetYRatio ?? 0) * height;
  const centerTX = width / 2 + offsetX;
  const centerTY = blockCenterY + offsetY;
  const manualScale = Math.max(0.4, Math.min(3, captionTransform?.scale ?? 1));
  const rotationRad = ((captionTransform?.rotationDeg ?? 0) * Math.PI) / 180;
  const combinedScale = manualScale * pageLayout.scale;

  ctx.save();
  ctx.translate(centerTX, centerTY);
  ctx.rotate(rotationRad);
  ctx.scale(combinedScale, combinedScale);
  ctx.translate(-width / 2, -blockCenterY);

  const spaceW = measureTextWidth(ctx, ' ', characterSpacing);
  const dim = karaokeNonActiveFills(style);

  for (let li = 0; li < pageLines.length; li++) {
    const lineY = topPad + li * lineHeight + lineHeight / 2;
    let x = blockLeft;

    for (const word of pageLines[li]) {
      const hasStarted = currentTime >= word.start;
      const isActive = hasStarted && currentTime < word.end;

      const wordX = x;
      x += word.wordWidth + spaceW;
      const wordAlpha = isActive ? 1 : hasStarted ? KARAOKE_COMPLETE_ALPHA : KARAOKE_INACTIVE_ALPHA;

      let scale = 1.0;
      if (isActive && hasPulse(anim)) {
        const wordDuration = Math.max(0.05, word.end - word.start);
        const progress = Math.min(1, ((currentTime - word.start) / wordDuration) * 4);
        scale = 1 + 0.035 * springEase(progress);
      }

      ctx.save();
      ctx.globalAlpha = wordAlpha * pageFade;
      ctx.shadowColor = isActive ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = isActive ? Math.max(14, fontSize * 0.22) : Math.max(6, fontSize * 0.08);

      if (scale !== 1.0) {
        const cx = wordX + word.wordWidth / 2;
        ctx.translate(cx, lineY);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -lineY);
      }

      const wordDuration = Math.max(0.05, word.end - word.start);
      const rawProgress = (currentTime - word.start) / wordDuration;
      const progress = Math.min(1, Math.max(0, rawProgress));
      const useSweep = isActive && hasSweep(anim);

      const dimFill = hasStarted && !isActive ? dim.complete : dim.upcoming;
      ctx.fillStyle = isActive ? textColor : dimFill;
      drawSpacedText(ctx, word.text, wordX, lineY, { characterSpacing });

      if (useSweep) {
        const revealWidth = Math.max(0, word.wordWidth * progress);
        ctx.save();
        ctx.beginPath();
        ctx.rect(wordX, lineY - lineHeight * 0.6, revealWidth, lineHeight * 1.2);
        ctx.clip();
        ctx.fillStyle = textColor;
        drawSpacedText(ctx, word.text, wordX, lineY, { characterSpacing });
        ctx.restore();
      } else if (isActive) {
        ctx.fillStyle = textColor;
        drawSpacedText(ctx, word.text, wordX, lineY, { characterSpacing });
      }

      ctx.restore();
    }
  }

  ctx.restore();
  ctx.globalAlpha = 1.0;
}
