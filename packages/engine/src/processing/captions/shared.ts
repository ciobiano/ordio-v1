import type { StyleConfig, Word } from '@Ordio/shared/schemas';
import type { CanvasLayout, CaptionGroup } from '../../types';
import { buildFixedWordChunks, buildSentenceSegments, findActiveDisplaySegment } from '../../captions/display';
import {
  GAP_ABOVE_WAVEFORM,
  WAVEFORM_CENTER_Y,
  WAVEFORM_CENTER_Y_FLIPPED,
  WAVEFORM_MAX_AMP,
} from '../../waveforms/constants';

/** Horizontal caption alignment. Older persisted styles predate the field, so renderers read it defensively. */
export type TextAlign = NonNullable<StyleConfig['textAlign']>;
export const DEFAULT_TEXT_ALIGN: TextAlign = 'center';

export type VerticalAlign = NonNullable<StyleConfig['verticalAlign']>;
export const DEFAULT_VERTICAL_ALIGN: VerticalAlign = 'auto';

/**
 * How far above the bottom edge a 'bottom'-anchored caption block sits. The
 * design study's own "22% from base" — high enough to clear a phone's UI
 * chrome, low enough to leave the frame's subject visible.
 */
export const CAPTION_BOTTOM_ANCHOR_RATIO = 0.22;

/**
 * Top edge of a caption block under an explicit vertical anchor. Returns null
 * for 'auto' so each mechanic falls through to the waveform-aware placement it
 * has always used — that's what keeps every pre-existing look pixel-identical.
 */
export function resolveBlockTopForAlign(
  vAlign: VerticalAlign,
  height: number,
  blockHeight: number,
  topRatio: number
): number | null {
  if (vAlign === 'auto') return null;

  const safePad = height * CAPTION_VERTICAL_SAFE_RATIO;
  const maxTop = Math.max(safePad, height - safePad - blockHeight);

  if (vAlign === 'top') return Math.min(Math.max(safePad, height * topRatio), maxTop);
  if (vAlign === 'bottom') {
    return Math.min(Math.max(safePad, height * (1 - CAPTION_BOTTOM_ANCHOR_RATIO) - blockHeight), maxTop);
  }
  return Math.min(Math.max(safePad, (height - blockHeight) / 2), maxTop);
}

export const CAPTION_SIDE_MARGIN_PX = 2;
/** Phrase captions keep a real safe margin so text never runs edge-to-edge. */
export const CAPTION_SIDE_MARGIN_RATIO = 0.06;
export const CAPTION_VERTICAL_SAFE_RATIO = 0.08;
export const FONT_WEIGHT = '600';

/**
 * Families that ship a single weight. Asking canvas for a heavier one renders
 * a synthesized faux-bold instead of the real face, which is exactly the
 * smeared look Instrument Serif's thin strokes fall apart into.
 */
const SINGLE_WEIGHT_FONTS: Record<string, string> = {
  'Instrument Serif': '400',
};

export function resolveFontWeight(fontFamily: string, desired: string = FONT_WEIGHT): string {
  return SINGLE_WEIGHT_FONTS[fontFamily] ?? desired;
}
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
/**
 * How wide a caption block may get, as a fraction of canvas width. Text wraps
 * on reaching it — it never shrinks to stay on one line. Styles may go
 * narrower (the design study's panels do); none may exceed the side margin.
 */
export const CAPTION_MAX_WIDTH_RATIO = 0.88;
export const HIGHLIGHT_TEXT_WIDTH_RATIO = 0.84;
/** Floor for the one unavoidable clamp: a single word wider than the max width. */
export const HIGHLIGHT_MIN_SCALE = 0.7;
export const HIGHLIGHT_MIN_WORDS_PER_LINE = 3;
export const HIGHLIGHT_LINE_HEIGHT_RATIO = 1.0;
export const CHIP_PADDING_X_RATIO = 0.28;
export const CHIP_PADDING_Y_RATIO = 0.18;
export const CHIP_RADIUS_RATIO = 0.22;

/** Progressive-reveal: opacity an unspoken word sits at before its timestamp arrives. */
export const PROGRESSIVE_REVEAL_DIM_OPACITY = 0.32;
/** The study's 44px gutters on a 360px frame — wider than the other mechanics use. */
export const PROGRESSIVE_REVEAL_TEXT_WIDTH_RATIO = 0.76;
export const PROGRESSIVE_REVEAL_TOP_RATIO = 0.18;
/**
 * A word whose alphanumeric core is this short never starts a wrapped line.
 * The study binds them to the previous word with a non-breaking space; here
 * the break is suppressed instead, because each word still has to be drawn
 * (and coloured) separately for the reveal.
 */
export const ORPHAN_MAX_CHARS = 4;

/**
 * The word block on screen. Fixed-size chunking (the design study's grouping)
 * when either the style or the session asks for it, else the content-aware
 * sentence segmentation the lyric styles have always used.
 */
export function buildCaptionScene(transcript: Word[], currentTime: number, chunkWords?: number): Word[] {
  const segments = chunkWords
    ? buildFixedWordChunks(transcript, chunkWords)
    : buildSentenceSegments(transcript);
  return findActiveDisplaySegment(segments, currentTime)?.words ?? [];
}

function isOrphanWord(text: string, orphanMaxChars: number): boolean {
  return text.replace(/[^A-Za-z0-9']/g, '').length <= orphanMaxChars;
}

/**
 * Fades a #rrggbb color to an rgba() string. Canvas has no per-fill opacity
 * that survives shadows, so the dim state has to live in the color itself.
 * Falls back to the input untouched if it isn't parseable hex.
 */
export function dimColor(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;

  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return hex;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface HighlightCaptionMetrics {
  centerX: number;
  blockCenterY: number;
  blockWidth: number;
  blockHeight: number;
  layoutScale: number;
  /** X the block scales about — the user's manual scale pivots here too, so hit-testing must account for it. */
  pivotX: number;
}

export type LayoutWord = { text: string; start: number; end: number; wordWidth: number; pauseToNext: number };
export interface LineLayout { lines: LayoutWord[][]; scale: number; logicalMaxWidth: number }

function greedyLineWidth(words: LayoutWord[], spaceWidth: number): number {
  if (words.length === 0) return 0;
  return words.reduce((sum, word) => sum + word.wordWidth, 0) + spaceWidth * (words.length - 1);
}

function buildGreedyLines(
  words: LayoutWord[],
  spaceWidth: number,
  maxWidth: number,
  minWordsPerLine: number,
  linePauseBreak: number,
  orphanMaxChars: number
): LayoutWord[][] {
  const lines: LayoutWord[][] = [];
  let line: LayoutWord[] = [];
  let lineWidth = 0;

  for (const word of words) {
    const needed = line.length === 0 ? word.wordWidth : lineWidth + spaceWidth + word.wordWidth;
    const prevPauseToNext = line.length > 0 ? line[line.length - 1].pauseToNext : 0;
    const prevHasNaturalPause = prevPauseToNext >= linePauseBreak;
    // Width breaks are unconditional. Gating them on minWordsPerLine let a
    // line overrun, which used to be absorbed by shrinking the whole block —
    // the thing that made caption size jump between phrases.
    const widthOverflow = needed > maxWidth;
    const pauseBreak = prevHasNaturalPause && line.length >= minWordsPerLine;

    // "a", "is", "to" stranded at the head of a line reads as a typo, so a
    // short word stays with the words it belongs to even if that overruns.
    const wouldOrphan = orphanMaxChars > 0 && isOrphanWord(word.text, orphanMaxChars);

    if (line.length > 0 && !wouldOrphan && (pauseBreak || widthOverflow)) {
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
  options: {
    minWordsPerLine?: number;
    linePauseBreak?: number;
    /** 0 disables orphan control, preserving the pre-existing wrap exactly. */
    orphanMaxChars?: number;
  } = {}
): LineLayout {
  const minWordsPerLine = options.minWordsPerLine ?? HIGHLIGHT_MIN_WORDS_PER_LINE;
  const linePauseBreak = options.linePauseBreak ?? 0.24;
  const orphanMaxChars = options.orphanMaxChars ?? 0;

  // Wrap once, at the size the user chose. Text that needs more room gets
  // more lines, never smaller type — a caption that resizes per phrase reads
  // as glitchy, and every pro editor holds the size and wraps instead.
  const lines = buildGreedyLines(words, spaceWidth, maxWidth, minWordsPerLine, linePauseBreak, orphanMaxChars);
  const widestLine = Math.max(1, ...lines.map((line) => greedyLineWidth(line, spaceWidth)));

  // A block needing more room gets more lines. There is no line cap and no
  // height-based shrink: capping lines and squashing the overflow was the last
  // remaining source of per-phrase size jumps.
  if (widestLine <= maxWidth) {
    return { lines, scale: 1, logicalMaxWidth: maxWidth };
  }

  // The single case wrapping cannot fix: one word wider than the max width.
  // Nothing to break, so that word alone decides the clamp.
  const nextScale = Math.min(1, maxWidth / widestLine);
  const scale = Number.isFinite(nextScale) && nextScale > 0 ? Math.max(HIGHLIGHT_MIN_SCALE, nextScale) : 1;
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
  /** X the block scales about — the user's manual scale pivots here too, so hit-testing must account for it. */
  pivotX: number;
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


/** The horizontal safe margin captions never cross. Single source for both width-fitting and start/end alignment. */
export function getCaptionSideMargin(width: number): number {
  return Math.min(Math.max(CAPTION_SIDE_MARGIN_PX, width * CAPTION_SIDE_MARGIN_RATIO), width / 2);
}

/**
 * The caption block's maximum width. Every mechanic measures against this one
 * value so a phrase wraps at the same place whichever style is active. The
 * side margin is a hard floor; a style's own ratio may narrow it further.
 */
export function getMaxCaptionTextWidth(width: number, ratio = CAPTION_MAX_WIDTH_RATIO): number {
  return Math.min(width - getCaptionSideMargin(width) * 2, width * ratio);
}

/**
 * Left edge of one line of text under the active alignment. Multi-line
 * mechanics call this per line (so each line aligns independently, the way
 * every editor treats alignment); single-line mechanics call it once.
 */
export function resolveLineX(
  align: TextAlign,
  lineWidth: number,
  canvasWidth: number,
  safeMargin: number
): number {
  if (align === 'start') return safeMargin;
  if (align === 'end') return canvasWidth - safeMargin - lineWidth;
  return (canvasWidth - lineWidth) / 2;
}

/**
 * X the caption block is scaled/rotated around. Captions scale by
 * fitScale x hookBoost x the user's manual scale, and whatever point this
 * returns is the one thing that stays put while they do.
 *
 * The pivot sits on whichever edge the alignment anchors to, so scaling grows
 * the text inward and the anchored edge stays welded to its margin. Pivoting
 * at the canvas center instead would let a hook-boosted start-aligned caption
 * slide left past the safe margin — off-frame on the very line meant to be
 * the most readable.
 *
 * Mirrors resolveLineX's margin convention exactly; the two disagreeing is
 * what would make text drift off the edge it is anchored to.
 */
export function resolveScalePivotX(
  align: TextAlign,
  canvasWidth: number,
  safeMargin: number
): number {
  if (align === 'start') return safeMargin;
  if (align === 'end') return canvasWidth - safeMargin;
  return canvasWidth / 2;
}

/** Where a point lands after the canvas is scaled about `pivot`. Keeps hit-test boxes on top of the drawn text. */
export function scaleAboutPivot(value: number, pivot: number, scale: number): number {
  return pivot + (value - pivot) * scale;
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
