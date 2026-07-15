import { describe, it, expect } from 'vitest';
import { findFillerWordIndices, cutRangesFromIndices } from '@/lib/studio/transcriptCuts';
import type { Word } from '@Ordio/shared/schemas';

const words = (texts: string[]): Word[] =>
  texts.map((text, i) => ({ text, start: i, end: i + 1 }));

describe('findFillerWordIndices', () => {
  it('finds ums and uhs, punctuation-tolerant, case-insensitive', () => {
    const transcript = words(['Okay', 'um', 'I', 'quit', 'Uh,', 'honestly', 'umm']);
    expect(findFillerWordIndices(transcript)).toEqual([1, 4, 6]);
  });

  it('does not flag real words that merely start with filler letters', () => {
    const transcript = words(['umbrella', 'understand', 'ahead', 'error']);
    expect(findFillerWordIndices(transcript)).toEqual([]);
  });

  it('returns empty for empty transcript', () => {
    expect(findFillerWordIndices([])).toEqual([]);
  });
});

describe('cutRangesFromIndices', () => {
  it('merges adjacent cut words into one range', () => {
    const transcript = words(['a', 'b', 'c', 'd', 'e']);
    const ranges = cutRangesFromIndices(transcript, new Set([1, 2, 4]));
    expect(ranges).toEqual([
      { start: 1, end: 3 },
      { start: 4, end: 5 },
    ]);
  });

  it('ignores out-of-bounds indices', () => {
    const transcript = words(['a', 'b']);
    expect(cutRangesFromIndices(transcript, new Set([-1, 5]))).toEqual([]);
  });

  it('returns empty for no cuts', () => {
    expect(cutRangesFromIndices(words(['a']), new Set())).toEqual([]);
  });
});
