import type { Word, StyleConfig } from '@Ordio/shared/schemas';
import type { CaptionAnimation, CaptionGroup } from '@/stores/types';
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
const KARAOKE_COMPLETE_ALPHA = 0.92;
const KARAOKE_LINE_PAUSE_BREAK = 0.24;
const KARAOKE_TEXT_WIDTH_RATIO = 0.84;
const KARAOKE_TOP_RATIO = 0.15;
const SCALE_CANDIDATES = [1, 0.94, 0.88, 0.82, 0.76, KARAOKE_MIN_SCALE];

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

export function drawKaraokeCaptions(
  ctx: CanvasRenderingContext2D,
  currentTime: number,
  transcript: Word[],
  style: StyleConfig,
  _groups?: CaptionGroup[],
  animation: CaptionAnimation = 'sweep-pulse'
): void {
  if (transcript.length === 0) return;

  const { width, height, textColor, fontFamily, fontSize, characterSpacing = 0, lineHeight: lineHeightMultiplier = 1.4 } = style;
  const padding = Math.min(CAPTION_SIDE_MARGIN_PX, width / 2);
  const blockWidth = Math.min(width - padding * 2, width * KARAOKE_TEXT_WIDTH_RATIO);
  const maxWidth = blockWidth;
  const scene = findActiveDisplaySegment(buildSentenceSegments(transcript), currentTime)?.words ?? [];
  if (scene.length === 0) return;

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

  ctx.save();
  ctx.translate(width / 2, blockCenterY);
  ctx.scale(pageLayout.scale, pageLayout.scale);
  ctx.translate(-width / 2, -blockCenterY);

  for (let li = 0; li < pageLines.length; li++) {
    const lineY = topPad + li * lineHeight + lineHeight / 2;
    let x = blockLeft;

    for (const word of pageLines[li]) {
      const hasStarted = currentTime >= word.start;
      const isActive = hasStarted && currentTime < word.end;

      const wordX = x;
      x += word.wordWidth + spaceWidth;
      const wordAlpha = isActive ? 1 : hasStarted ? KARAOKE_COMPLETE_ALPHA : KARAOKE_INACTIVE_ALPHA;

      let scale = 1.0;
      if (isActive && hasPulse(animation)) {
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
      const useSweep = isActive && hasSweep(animation);

      // Base text layer
      ctx.fillStyle = textColor;
      drawSpacedText(ctx, word.text, wordX, lineY, { characterSpacing });

      if (useSweep) {
        // Active layer reveals left->right with the same text color, keeping
        // karaoke closer to an editorial type-on treatment than a neon sweep.
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
