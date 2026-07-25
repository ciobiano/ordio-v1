import type { Word } from '@Ordio/shared/schemas';
import type { CanvasLayout, CaptionGroup } from '../../types';
import {
  GAP_ABOVE_WAVEFORM,
  WAVEFORM_CENTER_Y,
  WAVEFORM_CENTER_Y_FLIPPED,
  WAVEFORM_MAX_AMP,
} from '../../waveforms/constants';

export const CAPTION_SIDE_MARGIN_PX = 2;
export const CAPTION_VERTICAL_SAFE_RATIO = 0.08;
export const FONT_WEIGHT = '600';
export const MIN_CAPTION_SAFE_ZONE = 0.02;
export const PHRASE_FADE_DURATION = 0.15;
export const PHRASE_TOP_RATIO = 0.18;
export const PHRASE_TOP_WITH_VISUAL_RATIO = 0.14;
export const STACK_COLUMN_RATIO = 1.22;
export const STACK_LEFT_RATIO = 0.083;
export const STACK_TOP_RATIO = 0.135;
export const STACK_LINE_HEIGHT_RATIO = 1.18;
export const STACK_TARGET_WORDS_PER_LINE = 7;
export const SUPPORTING_ALPHA = 0.22;
export const SUPPORTING_SCALE = 0.78;
export const SPOTLIGHT_WIDTH_RATIO = 0.86;
export const SPOTLIGHT_TOP_RATIO = 0.2;
export const SPOTLIGHT_WITH_VISUAL_RATIO = 0.14;

/** Hook Card (Ordio Director): scale multiplier applied on top of the active
 * caption style's own rendering when the group is marked CaptionGroup.role === 'hook'. */
export const HOOK_SCALE_MULTIPLIER = 1.4;

// --- Caption style presets (word-pop, bold-outline, karaoke-chip, minimal-lower-third,
// big-statement, script-accent) — shared constants for the 3 reveal mechanics. ---
/** Default thin legibility stroke every style falls back to when its preset/StyleConfig doesn't specify one. */
export const DEFAULT_STROKE_WIDTH_RATIO = 0.022;
export const DEFAULT_STROKE_COLOR = 'rgba(0, 0, 0, 0.28)';
export const HIGHLIGHT_TOP_RATIO = 0.15;
export const HIGHLIGHT_TEXT_WIDTH_RATIO = 0.84;
export const HIGHLIGHT_MAX_LINES = 4;
export const HIGHLIGHT_MIN_SCALE = 0.7;
export const HIGHLIGHT_MIN_WORDS_PER_LINE = 3;
export const HIGHLIGHT_LINE_HEIGHT_RATIO = 1.0;
export const CHIP_PADDING_X_RATIO = 0.28;
export const CHIP_PADDING_Y_RATIO = 0.18;
export const CHIP_RADIUS_RATIO = 0.22;

export interface HighlightCaptionMetrics {
  centerX: number;
  blockCenterY: number;
  blockWidth: number;
  blockHeight: number;
  layoutScale: number;
}

export type LayoutWord = { text: string; start: number; end: number; wordWidth: number; pauseToNext: number };
export interface LineLayout { lines: LayoutWord[][]; scale: number; logicalMaxWidth: number }

const LINE_FIT_SCALE_CANDIDATES = [1, 0.94, 0.88, 0.82, 0.76, HIGHLIGHT_MIN_SCALE];

function greedyLineWidth(words: LayoutWord[], spaceWidth: number): number {
  if (words.length === 0) return 0;
  return words.reduce((sum, word) => sum + word.wordWidth, 0) + spaceWidth * (words.length - 1);
}

function buildGreedyLines(
  words: LayoutWord[],
  spaceWidth: number,
  maxWidth: number,
  minWordsPerLine: number,
  linePauseBreak: number
): LayoutWord[][] {
  const lines: LayoutWord[][] = [];
  let line: LayoutWord[] = [];
  let lineWidth = 0;

  for (const word of words) {
    const needed = line.length === 0 ? word.wordWidth : lineWidth + spaceWidth + word.wordWidth;
    const prevPauseToNext = line.length > 0 ? line[line.length - 1].pauseToNext : 0;
    const prevHasNaturalPause = prevPauseToNext >= linePauseBreak;
    const widthOverflow = line.length >= minWordsPerLine && needed > maxWidth;

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

function packWordsIntoLineCount(words: LayoutWord[], maxLines: number): LayoutWord[][] {
  const lines: LayoutWord[][] = [];
  const wordsPerLine = Math.ceil(words.length / maxLines);

  for (let index = 0; index < words.length; index += wordsPerLine) {
    lines.push(words.slice(index, index + wordsPerLine));
  }

  return lines.slice(0, maxLines);
}

/**
 * Greedy multi-line word wrap with scale-fitting, breaking early on natural
 * speech pauses. Shared by any mechanic that lays out a full line/block of
 * words at once (currently staticHighlight). Ported from the pre-redesign
 * karaoke mode's layout — see git history for the original if needed.
 */
export function layoutWrappedLines(
  words: LayoutWord[],
  spaceWidth: number,
  maxWidth: number,
  options: { maxLines?: number; minWordsPerLine?: number; linePauseBreak?: number } = {}
): LineLayout {
  const maxLines = options.maxLines ?? HIGHLIGHT_MAX_LINES;
  const minWordsPerLine = options.minWordsPerLine ?? HIGHLIGHT_MIN_WORDS_PER_LINE;
  const linePauseBreak = options.linePauseBreak ?? 0.24;

  for (const scale of LINE_FIT_SCALE_CANDIDATES) {
    const logicalMaxWidth = maxWidth / scale;
    const lines = buildGreedyLines(words, spaceWidth, logicalMaxWidth, minWordsPerLine, linePauseBreak);
    const widestLine = Math.max(1, ...lines.map((line) => greedyLineWidth(line, spaceWidth)));
    if (lines.length <= maxLines && widestLine <= logicalMaxWidth) {
      return { lines, scale, logicalMaxWidth };
    }
  }

  const lines = packWordsIntoLineCount(words, maxLines);
  const widestLine = Math.max(1, ...lines.map((line) => greedyLineWidth(line, spaceWidth)));
  const nextScale = Math.min(1, maxWidth / widestLine);
  const scale = Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1;

  return { lines, scale, logicalMaxWidth: maxWidth / scale };
}

export interface PhraseCaptionMetrics {
  text: string;
  lines: string[];
  centerX: number;
  textY: number;
  lineHeight: number;
  blockWidth: number;
  blockHeight: number;
  blockCenterY: number;
  fitScale: number;
}

export interface StackCaptionMetrics {
  lines: string[];
  blockLeft: number;
  blockTop: number;
  blockCenterY: number;
  blockCenterX: number;
  blockWidth: number;
  blockHeight: number;
  lineHeight: number;
}

export interface SpotlightCaptionMetrics {
  centerX: number;
  centerY: number;
  blockCenterY: number;
  blockWidth: number;
  blockHeight: number;
}


export function getMaxCaptionTextWidth(width: number): number {
  const padding = Math.min(CAPTION_SIDE_MARGIN_PX, width / 2);
  return width - padding * 2;
}

export function calculatePhraseTextY(
  height: number,
  layout: CanvasLayout,
  hasVisualZone: boolean,
  flipped: boolean,
  blockHeight: number
): number {
  const safePad = height * CAPTION_VERTICAL_SAFE_RATIO;

  if (!hasVisualZone) {
    return Math.max(safePad, height * PHRASE_TOP_RATIO);
  }

  if (!flipped) {
    const waveformTop = height * WAVEFORM_CENTER_Y - height * WAVEFORM_MAX_AMP;
    const captionBottom = waveformTop - height * GAP_ABOVE_WAVEFORM;
    const maxTextY = captionBottom - height * MIN_CAPTION_SAFE_ZONE - blockHeight;
    const preferredY =
      layout === 'top'
        ? height * PHRASE_TOP_WITH_VISUAL_RATIO
        : layout === 'compact'
          ? height * (PHRASE_TOP_WITH_VISUAL_RATIO + 0.04)
          : height * 0.2;
    return Math.max(Math.min(preferredY, maxTextY), safePad);
  }

  const waveformBottom = WAVEFORM_CENTER_Y_FLIPPED * height + height * WAVEFORM_MAX_AMP;
  const captionTop = waveformBottom + height * GAP_ABOVE_WAVEFORM;
  const captionBottom = height - safePad;
  const textY =
    layout === 'compact'
      ? captionTop
      : Math.max(captionTop, captionTop + (captionBottom - captionTop - blockHeight) / 2);
  return Math.min(textY, captionBottom - blockHeight);
}

export function getSpotlightCenterY(
  height: number,
  lineHeight: number,
  layout: CanvasLayout,
  hasVisualZone: boolean
): number {
  if (!hasVisualZone) return height * SPOTLIGHT_TOP_RATIO;

  const visualTop = height * WAVEFORM_CENTER_Y - height * WAVEFORM_MAX_AMP;
  const captionBottom = visualTop - height * GAP_ABOVE_WAVEFORM;
  const preferredY =
    layout === 'compact'
      ? height * (SPOTLIGHT_WITH_VISUAL_RATIO + 0.04)
      : height * SPOTLIGHT_WITH_VISUAL_RATIO;
  return Math.min(preferredY, captionBottom - lineHeight);
}

/** Active word index by hard time-window lookup — used by the word-swap mechanic. */
export function findActiveWordIndex(transcript: Word[], currentTime: number): number {
  const idx = transcript.findIndex((w) => currentTime >= w.start && currentTime < w.end);
  if (idx >= 0) return idx;

  const nextIdx = transcript.findIndex((w) => w.start > currentTime);
  if (nextIdx > 0) return nextIdx - 1;
  if (transcript.length > 0 && currentTime >= transcript[transcript.length - 1].end) {
    return transcript.length - 1;
  }
  return -1;
}

/**
 * True if the word at `globalWordIndex` (an index into the full transcript)
 * is marked accented in `group.accentWordIndices`. accentWordIndices holds
 * indices into `group.wordIndices`, not raw transcript indices — this
 * resolves that indirection so callers can check by transcript index.
 */
export function isGlobalWordIndexAccented(
  group: CaptionGroup | null | undefined,
  globalWordIndex: number
): boolean {
  if (!group?.accentWordIndices?.length) return false;
  return group.accentWordIndices.some((localIdx) => group.wordIndices[localIdx] === globalWordIndex);
}

export function getActiveCaptionGroup(
  groups: CaptionGroup[],
  currentTime: number
): CaptionGroup | null {
  const activeGroup = groups.find((group) => currentTime >= group.start && currentTime < group.end);
  if (activeGroup) return activeGroup;

  const nextGroupIndex = groups.findIndex((group) => group.start > currentTime);
  if (nextGroupIndex > 0) return groups[nextGroupIndex - 1];
  if (groups.length > 0 && currentTime >= groups[groups.length - 1].end) {
    return groups[groups.length - 1];
  }

  return null;
}
