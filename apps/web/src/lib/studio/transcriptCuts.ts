import type { Word } from '@Ordio/shared/schemas';

/** Filler tokens Descript-style cleanup removes. Punctuation-tolerant. */
const FILLER_PATTERN = /^(um+|uh+|uhm+|erm+|hmm+|mm+|ah+|er+)[,.!?…]?$/i;

export function findFillerWordIndices(transcript: Word[]): number[] {
  return transcript
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => FILLER_PATTERN.test(word.text.trim()))
    .map(({ index }) => index);
}

export interface CutRange {
  start: number;
  end: number;
}

/**
 * Merges cut word indices into contiguous time ranges (seconds) for
 * timeline visualization. Adjacent/overlapping word ranges collapse.
 */
export function cutRangesFromIndices(transcript: Word[], indices: Set<number>): CutRange[] {
  const ranges = [...indices]
    .filter((i) => i >= 0 && i < transcript.length)
    .sort((a, b) => a - b)
    .map((i) => ({ start: transcript[i].start, end: transcript[i].end }));

  const merged: CutRange[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end + 0.02) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}
