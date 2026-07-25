import { describe, it, expect } from 'vitest';
import {
  isGlobalWordIndexAccented,
  findActiveWordIndex,
  getActiveCaptionGroup,
} from '../src/processing/captions/shared';
import type { CaptionGroup } from '../src/types';

const group: CaptionGroup = {
  text: 'so i tried it',
  start: 0,
  end: 1,
  wordIndices: [10, 11, 12, 13],
  accentWordIndices: [2], // local position 2 -> global word index 12 ("tried")
};

describe('isGlobalWordIndexAccented', () => {
  it('is true for the global index the accent position resolves to', () => {
    expect(isGlobalWordIndexAccented(group, 12)).toBe(true);
  });

  it('is false for other global indices in the same group', () => {
    expect(isGlobalWordIndexAccented(group, 10)).toBe(false);
    expect(isGlobalWordIndexAccented(group, 13)).toBe(false);
  });

  it('does not crash and returns false when accentWordIndices holds an out-of-range position', () => {
    const malformed: CaptionGroup = { ...group, accentWordIndices: [99] };
    expect(() => isGlobalWordIndexAccented(malformed, 12)).not.toThrow();
    expect(isGlobalWordIndexAccented(malformed, 12)).toBe(false);
  });

  it('returns false when accentWordIndices is absent or empty', () => {
    expect(isGlobalWordIndexAccented({ ...group, accentWordIndices: undefined }, 12)).toBe(false);
    expect(isGlobalWordIndexAccented({ ...group, accentWordIndices: [] }, 12)).toBe(false);
  });

  it('returns false for a null/undefined group', () => {
    expect(isGlobalWordIndexAccented(null, 12)).toBe(false);
    expect(isGlobalWordIndexAccented(undefined, 12)).toBe(false);
  });
});

describe('findActiveWordIndex (word-swap mechanic)', () => {
  const words = [
    { text: 'wait', start: 0, end: 0.3 },
    { text: 'this', start: 0.3, end: 0.6 },
    { text: 'works', start: 0.6, end: 0.9 },
  ];

  it('returns the word whose time window contains currentTime', () => {
    expect(findActiveWordIndex(words, 0.45)).toBe(1);
  });

  it('holds the last word past the end of the transcript', () => {
    expect(findActiveWordIndex(words, 5)).toBe(2);
  });

  it('returns -1 before the first word starts', () => {
    expect(findActiveWordIndex([{ text: 'late', start: 1, end: 1.3 }], 0)).toBe(-1);
  });
});

describe('getActiveCaptionGroup (phrase-cut hard-cut boundary)', () => {
  const groups: CaptionGroup[] = [
    { text: 'First phrase', start: 0, end: 0.6, wordIndices: [0, 1] },
    { text: 'Second phrase', start: 0.6, end: 1.2, wordIndices: [2, 3] },
  ];

  it('never returns the previous group once the next group has started', () => {
    const active = getActiveCaptionGroup(groups, 0.8);
    expect(active?.text).toBe('Second phrase');
  });
});
