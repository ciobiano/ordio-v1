import type { Word } from '@Ordio/shared/schemas';
import { buildSmartSegments, type CaptionSegment } from './segmentation';

/**
 * How the transcript is cut into caption blocks.
 *
 *   punct    — content-aware: punctuation and speech pauses, weighted
 *   single   — one word per block
 *   quantity — a fixed number of words per block
 *   time     — as many words as fit inside a hold duration
 *   random   — varied block lengths, for a looser rhythm
 */
export type BreakMode = 'punct' | 'single' | 'quantity' | 'time' | 'random';

/** 'random' quantity means "vary it", not a literal count. */
export type BreakQuantity = number | 'random';

export interface BreakOptions {
  mode: BreakMode;
  /** Words per block in `quantity` mode. */
  quantity?: BreakQuantity;
  /** Seconds each block holds in `time` mode. */
  holdSeconds?: number;
}

export const MIN_BREAK_QUANTITY = 1;
export const MAX_BREAK_QUANTITY = 8;
export const MIN_HOLD_SECONDS = 1;
export const MAX_HOLD_SECONDS = 6;

/** Block sizes `random` picks between — short enough to read, long enough to vary. */
const RANDOM_MIN_WORDS = 2;
const RANDOM_MAX_WORDS = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Deterministic PRNG (mulberry32).
 *
 * `random` has to be reproducible: segmentation is recomputed whenever the
 * transcript is rebuilt, and Math.random would reshuffle every caption in the
 * clip each time — the user would watch their edit reflow for no reason. Seeded
 * from the transcript itself, the same words always cut the same way.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable seed for a given run of words — content, not identity. */
function seedFrom(words: Word[]): number {
  let hash = words.length;
  for (const word of words) {
    for (let i = 0; i < word.text.length; i++) {
      hash = (Math.imul(hash, 31) + word.text.charCodeAt(i)) | 0;
    }
  }
  return hash;
}

function toSegment(words: Word[], startIndex: number, endIndex: number): CaptionSegment {
  return {
    startIndex,
    endIndex,
    start: words[startIndex].start,
    end: words[endIndex - 1].end,
    text: words
      .slice(startIndex, endIndex)
      .map((word) => word.text)
      .join(' '),
  };
}

/** Cut into blocks whose sizes come from `nextSize`, walking left to right. */
function chunkBy(words: Word[], nextSize: () => number): CaptionSegment[] {
  const out: CaptionSegment[] = [];
  let start = 0;

  while (start < words.length) {
    const size = Math.max(1, Math.floor(nextSize()));
    const end = Math.min(words.length, start + size);
    out.push(toSegment(words, start, end));
    start = end;
  }

  return out;
}

/**
 * Cut into blocks that each hold for roughly `holdSeconds`.
 *
 * A word is admitted if the block is still empty, or if adding it keeps the
 * block inside the budget. A single word longer than the budget still gets its
 * own block rather than being dropped — the alternative is losing speech.
 */
function chunkByTime(words: Word[], holdSeconds: number): CaptionSegment[] {
  const budget = clamp(holdSeconds, MIN_HOLD_SECONDS, MAX_HOLD_SECONDS);
  const out: CaptionSegment[] = [];
  let start = 0;

  for (let i = 0; i < words.length; i++) {
    const elapsed = words[i].end - words[start].start;
    const isLast = i === words.length - 1;

    if (elapsed >= budget || isLast) {
      // Close *after* this word when it is the last one, otherwise the trailing
      // words would never be emitted.
      const end = isLast ? words.length : i + 1;
      out.push(toSegment(words, start, end));
      start = end;
      if (start >= words.length) break;
    }
  }

  return out;
}

/**
 * Cut a run of words into caption blocks under the chosen rule.
 *
 * Indices in the returned segments are relative to the `words` array passed in,
 * so this works equally on a whole transcript and on one group's slice — which
 * is what lets a break setting apply to everything or to a single caption.
 */
export function buildSegmentsForMode(words: Word[], options: BreakOptions): CaptionSegment[] {
  if (words.length === 0) return [];

  switch (options.mode) {
    case 'single':
      return chunkBy(words, () => 1);

    case 'quantity': {
      if (options.quantity === 'random') return buildSegmentsForMode(words, { mode: 'random' });
      const size = clamp(options.quantity ?? 4, MIN_BREAK_QUANTITY, MAX_BREAK_QUANTITY);
      return chunkBy(words, () => size);
    }

    case 'time':
      return chunkByTime(words, options.holdSeconds ?? 3);

    case 'random': {
      const random = mulberry32(seedFrom(words));
      const span = RANDOM_MAX_WORDS - RANDOM_MIN_WORDS + 1;
      return chunkBy(words, () => RANDOM_MIN_WORDS + Math.floor(random() * span));
    }

    case 'punct':
    default:
      return buildSmartSegments(words);
  }
}
