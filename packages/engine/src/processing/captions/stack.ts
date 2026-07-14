import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionGroup, CaptionTransform } from '@/stores';
import { drawSpacedText, measureTextWidth } from '@/lib/video/textLayout';
import {
  buildStackSegments,
  findActiveDisplaySegment,
} from '@/lib/captions/display';
import { hasStrongPunctuation, hasSoftPunctuation } from '@/lib/captions/display/textBoundaries';
import {
  STACK_COLUMN_RATIO,
  STACK_LEFT_RATIO,
  STACK_LINE_HEIGHT_RATIO,
  STACK_TOP_RATIO,
  type StackCaptionMetrics,
} from './shared';

const STACK_FONT_WEIGHT = '400';
const STACK_TARGET_WORDS_PER_LINE = 5;

type StackWord = Word & {
  width: number;
};

/**
 * Stack mode derives its own large-block segmentation from the full transcript
 * using buildStackSegments (16-26 words per block, prioritising full stops over
 * commas). The phrase-level captionGroups from processingStore are intentionally
 * ignored here — they are built for phrase mode (max 7 words) and would produce
 * tiny blocks that defeat the 4-line fill goal of stack mode.
 */
function getActiveStackSceneWords(
  transcript: Word[],
  currentTime: number,
  _groups?: CaptionGroup[]
): StackWordSource {
  const segments = buildStackSegments(transcript);
  const activeSegment = findActiveDisplaySegment(segments, currentTime);
  if (activeSegment) {
    return { words: activeSegment.words };
  }

  const nextIndex = segments.findIndex((s) => s.start > currentTime);
  if (nextIndex > 0) {
    return { words: segments[nextIndex - 1].words };
  }
  if (segments.length > 0 && currentTime >= segments[segments.length - 1].end) {
    return { words: segments[segments.length - 1].words };
  }

  return { words: [] };
}

interface StackWordSource {
  words: Word[];
}

function measureStackWords(
  ctx: CanvasRenderingContext2D,
  words: Word[],
  characterSpacing: number
): StackWord[] {
  return words.map((word) => ({
    ...word,
    width: measureTextWidth(ctx, word.text, characterSpacing),
  }));
}

function stackLineText(words: StackWord[]): string {
  return words.map((word) => word.text).join(' ');
}

function stackLineWidth(words: StackWord[], spaceWidth: number): number {
  if (words.length === 0) return 0;
  return words.reduce((sum, word) => sum + word.width, 0) + spaceWidth * (words.length - 1);
}

function targetStackLineCount(words: StackWord[]): number {
  return Math.max(1, Math.min(4, Math.ceil(words.length / STACK_TARGET_WORDS_PER_LINE)));
}

/**
 * Scores a proposed line break. Lower is better.
 *
 * Priority order:
 * 1. Hard overflow is the dominant penalty — never let a line exceed maxWidth.
 * 2. Raggedness (deviation from target width) keeps lines balanced.
 * 3. Short-line penalty discourages orphan words on non-final lines.
 * 4. Punctuation is a *tiebreaker only* — it never pulls a break in earlier
 *    than the layout requires. Full stop > comma > nothing.
 */
function lineBreakCost(
  line: StackWord[],
  lineIndex: number,
  lineCount: number,
  maxWidth: number,
  targetWidth: number,
  spaceWidth: number
): number {
  const width = stackLineWidth(line, spaceWidth);
  const overflow = Math.max(0, width - maxWidth);
  const raggedness = Math.pow((targetWidth - Math.min(width, maxWidth)) / Math.max(1, targetWidth), 2);
  const shortLinePenalty = line.length < 3 && lineIndex < lineCount - 1 ? 4 : 0;

  // Punctuation tiebreaker: applied only when the optimizer is already choosing
  // between roughly equal splits. Values are small relative to raggedness so they
  // never override the line-count / width constraints.
  const lastWord = line[line.length - 1];
  const punctuationBonus = hasStrongPunctuation(lastWord)
    ? -0.08  // full stop / sentence-end — strongest preference
    : hasSoftPunctuation(lastWord)
      ? -0.04 // comma — weaker preference
      : 0;

  return (
    raggedness +
    shortLinePenalty +
    punctuationBonus +
    Math.pow(overflow / Math.max(1, maxWidth), 2) * 25
  );
}

function layoutStackLines(words: StackWord[], maxWidth: number, spaceWidth: number): StackWord[][] {
  const lineCount = targetStackLineCount(words);
  if (lineCount === 1) return [words];

  const totalWidth = stackLineWidth(words, spaceWidth);
  const targetWidth = Math.min(maxWidth, totalWidth / lineCount);
  const memo = new Map<string, { cost: number; breaks: number[] }>();

  const bestFrom = (wordIndex: number, lineIndex: number): { cost: number; breaks: number[] } => {
    const key = `${wordIndex}:${lineIndex}`;
    const cached = memo.get(key);
    if (cached) return cached;

    const linesLeft = lineCount - lineIndex;
    if (linesLeft === 1) {
      const line = words.slice(wordIndex);
      const result = {
        cost: lineBreakCost(line, lineIndex, lineCount, maxWidth, targetWidth, spaceWidth),
        breaks: [words.length],
      };
      memo.set(key, result);
      return result;
    }

    let best: { cost: number; breaks: number[] } | null = null;
    const maxEnd = words.length - (linesLeft - 1);
    for (let end = wordIndex + 1; end <= maxEnd; end++) {
      const line = words.slice(wordIndex, end);
      const remaining = bestFrom(end, lineIndex + 1);
      const cost =
        lineBreakCost(line, lineIndex, lineCount, maxWidth, targetWidth, spaceWidth) +
        remaining.cost;
      if (!best || cost < best.cost) {
        best = { cost, breaks: [end, ...remaining.breaks] };
      }
    }

    const result = best ?? { cost: 0, breaks: [words.length] };
    memo.set(key, result);
    return result;
  };

  const breaks = bestFrom(0, 0).breaks;
  const lines: StackWord[][] = [];
  let start = 0;
  for (const end of breaks) {
    lines.push(words.slice(start, end));
    start = end;
  }
  return lines;
}

interface StackSceneLayout {
  /** Raw word lines with per-word timing — used for word-by-word reveal. */
  wordLines: StackWord[][];
  /** Stable block metrics derived from the full word set. */
  metrics: StackCaptionMetrics;
  spaceWidth: number;
}

/**
 * Single layout pass shared by both measure and draw.
 * Layout is always computed from ALL words in the block so the grid never
 * reflows as words are progressively revealed during playback.
 */
function layoutStackScene(
  ctx: CanvasRenderingContext2D,
  transcript: Word[],
  currentTime: number,
  style: StyleConfig,
  groups?: CaptionGroup[]
): StackSceneLayout | null {
  if (transcript.length === 0) return null;

  const { width, height, fontFamily, fontSize, characterSpacing = 0 } = style;
  const scene = getActiveStackSceneWords(transcript, currentTime, groups);
  const words = scene.words;
  if (words.length === 0) return null;

  ctx.font = `${STACK_FONT_WEIGHT} ${fontSize}px "${fontFamily}", serif`;
  ctx.textBaseline = 'top';

  const maxWidth = Math.min(width * 0.68, Math.min(width, height) * STACK_COLUMN_RATIO);
  const spaceWidth = measureTextWidth(ctx, ' ', characterSpacing);
  const measuredWords = measureStackWords(ctx, words, characterSpacing);
  const wordLines = layoutStackLines(measuredWords, maxWidth, spaceWidth);
  if (wordLines.length === 0) return null;

  const lines = wordLines.map(stackLineText);
  const lineHeight = fontSize * STACK_LINE_HEIGHT_RATIO;
  const blockWidth = Math.max(
    0,
    ...lines.map((line) => measureTextWidth(ctx, line, characterSpacing))
  );
  const blockHeight = wordLines.length * lineHeight;
  const blockLeft = width * STACK_LEFT_RATIO;
  const blockTop = height * STACK_TOP_RATIO;

  return {
    wordLines,
    spaceWidth,
    metrics: {
      lines,
      blockLeft,
      blockTop,
      blockCenterX: blockLeft + blockWidth / 2,
      blockCenterY: blockTop + blockHeight / 2,
      blockWidth,
      blockHeight,
      lineHeight,
    },
  };
}

export function measureStackCaptionBlock(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  groups?: CaptionGroup[]
): StackCaptionMetrics | null {
  return layoutStackScene(ctx, transcript, currentTime, style, groups)?.metrics ?? null;
}

export function drawStackCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  groups?: CaptionGroup[],
  captionTransform?: CaptionTransform
): void {
  if (transcript.length === 0) return;
  if (captionTransform && !captionTransform.visible) return;

  const layout = layoutStackScene(ctx, transcript, currentTime, style, groups);
  if (!layout) return;

  const { wordLines, metrics, spaceWidth } = layout;
  const characterSpacing = style.characterSpacing ?? 0;

  const centerX = metrics.blockCenterX + (captionTransform?.offsetXRatio ?? 0) * style.width;
  const centerY = metrics.blockCenterY + (captionTransform?.offsetYRatio ?? 0) * style.height;
  const manualScale = Math.max(0.4, Math.min(3, captionTransform?.scale ?? 1));
  const rotationRad = ((captionTransform?.rotationDeg ?? 0) * Math.PI) / 180;

  ctx.save();
  ctx.font = `${STACK_FONT_WEIGHT} ${style.fontSize}px "${style.fontFamily}", serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.translate(centerX, centerY);
  ctx.rotate(rotationRad);
  ctx.scale(manualScale, manualScale);
  ctx.translate(-metrics.blockWidth / 2, -metrics.blockHeight / 2);

  for (let li = 0; li < wordLines.length; li++) {
    const lineY = li * metrics.lineHeight;
    let revealedText = '';

    for (const word of wordLines[li]) {
      // Only include words that have started
      if (word.start <= currentTime) {
        revealedText += (revealedText ? ' ' : '') + word.text;
      }
    }

    if (revealedText) {
      ctx.fillStyle = style.textColor;
      drawSpacedText(ctx, revealedText, 0, lineY, {
        textAlign: 'left',
        mode: 'fill',
        characterSpacing,
      });
    }
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}
