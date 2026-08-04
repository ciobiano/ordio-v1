import { describe, it, expect } from 'vitest';
import type { Word } from '@Ordio/shared/schemas';
import type { CaptionGroup } from '../src/types';
import { buildCaptionScene } from '../src/processing/captions/shared';

/**
 * The Breaks tab rewrites `captionGroups`, and for two of the four caption
 * mechanics that had no effect at all: `buildCaptionScene` derived its own
 * segmentation and never looked at the groups its callers were threading down
 * to it. Cutting your captions and watching nothing happen was the symptom.
 */

const WORDS: Word[] = [
  { text: 'one', start: 0, end: 1 },
  { text: 'two', start: 1, end: 2 },
  { text: 'three', start: 2, end: 3 },
  { text: 'four', start: 3, end: 4 },
  { text: 'five', start: 4, end: 5 },
  { text: 'six', start: 5, end: 6 },
];

function group(wordIndices: number[]): CaptionGroup {
  return {
    wordIndices,
    text: wordIndices.map((i) => WORDS[i].text).join(' '),
    start: WORDS[wordIndices[0]].start,
    end: WORDS[wordIndices[wordIndices.length - 1]].end,
  };
}

/** Two words per block — what "Quantity: Two" produces. */
const PAIRS = [group([0, 1]), group([2, 3]), group([4, 5])];

const textOf = (words: Word[]) => words.map((w) => w.text).join(' ');

describe('buildCaptionScene', () => {
  it("uses the user's groups over the style's chunk size", () => {
    // chunkWords says three; the user cut them into twos. The user wins.
    expect(textOf(buildCaptionScene(WORDS, 2.5, 3, PAIRS))).toBe('three four');
  });

  it("uses the user's groups over sentence segmentation", () => {
    expect(textOf(buildCaptionScene(WORDS, 4.5, undefined, PAIRS))).toBe('five six');
  });

  it('follows the groups across the timeline', () => {
    expect(textOf(buildCaptionScene(WORDS, 0.5, 3, PAIRS))).toBe('one two');
    expect(textOf(buildCaptionScene(WORDS, 2.5, 3, PAIRS))).toBe('three four');
    expect(textOf(buildCaptionScene(WORDS, 5.5, 3, PAIRS))).toBe('five six');
  });

  it('honours an uneven manual cut', () => {
    // A split or merge in the caption editor produces groups of mixed size.
    const uneven = [group([0]), group([1, 2, 3, 4, 5])];
    expect(textOf(buildCaptionScene(WORDS, 0.5, 2, uneven))).toBe('one');
    expect(textOf(buildCaptionScene(WORDS, 3, 2, uneven))).toBe('two three four five six');
  });

  it('clamps to the first group before the first caption starts', () => {
    // getActiveCaptionGroup returns null in the lead-in, where the derived path
    // clamps to its first segment. Falling through there would show a chunk the
    // user never asked for on the paused canvas at t=0.
    const late = [group([2, 3]), group([4, 5])];
    expect(textOf(buildCaptionScene(WORDS, 0, 3, late))).toBe('three four');
  });

  it('clamps to the last group past the end', () => {
    expect(textOf(buildCaptionScene(WORDS, 99, 3, PAIRS))).toBe('five six');
  });

  it('drops indices that outlived their words', () => {
    // A trim commit rebuilds the transcript; a stale group can point past it.
    const stale = [group([0, 1])];
    stale[0] = { ...stale[0], wordIndices: [0, 1, 99] };
    expect(textOf(buildCaptionScene(WORDS, 0.5, undefined, stale))).toBe('one two');
  });

  it('falls back to fixed chunks when there are no groups', () => {
    // Preset preview cards and any render before segmentation.
    expect(textOf(buildCaptionScene(WORDS, 0.5, 3))).toBe('one two three');
    expect(textOf(buildCaptionScene(WORDS, 0.5, 3, []))).toBe('one two three');
  });

  it('returns nothing for an empty transcript', () => {
    expect(buildCaptionScene([], 0, 3, PAIRS)).toEqual([]);
  });
});
