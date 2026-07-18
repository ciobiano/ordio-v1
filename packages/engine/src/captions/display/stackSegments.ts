import type { Word } from '@Ordio/shared/schemas';
import type { CaptionDisplaySegment } from './types';
import {
  hasStrongPunctuation,
  hasSoftPunctuation,
  joinWords,
  pauseAfter,
} from './textBoundaries';

// A 4-line stack at 5 words/line is roughly 20 words.
// We ignore all punctuation before MIN_STACK_WORDS to ensure the block fills up.
// Once in the threshold window, we prefer strong punctuation over soft.
const MIN_STACK_WORDS = 16;
const MAX_STACK_WORDS = 26;
const FALLBACK_PAUSE_SECONDS = 0.8;

export function buildStackSegments(transcript: Word[]): CaptionDisplaySegment[] {
  const segments: CaptionDisplaySegment[] = [];
  let startIndex = 0;

  while (startIndex < transcript.length) {
    const endIndex = findStackEndIndex(transcript, startIndex);
    segments.push(createSegment(transcript, startIndex, endIndex));
    startIndex = endIndex;
  }

  return segments;
}

function findStackEndIndex(transcript: Word[], startIndex: number): number {
  let bestPunctuationIndex = -1;

  for (let index = startIndex; index < transcript.length; index++) {
    const wordCount = index - startIndex + 1;
    const endExclusive = index + 1;

    // Hard limit reached. Break at the best punctuation we found in the window,
    // or if none, force a break right here.
    if (wordCount >= MAX_STACK_WORDS) {
      if (bestPunctuationIndex !== -1) {
        return bestPunctuationIndex + 1;
      }
      return endExclusive;
    }

    // Only consider breaking if we've accumulated enough words for the 4-line threshold
    if (wordCount >= MIN_STACK_WORDS) {
      if (hasStrongPunctuation(transcript[index])) {
        // Strong punctuation (full stop, etc.) -> optimal break point, break immediately
        return endExclusive;
      }

      if (hasSoftPunctuation(transcript[index])) {
        // Soft punctuation (comma) -> acceptable, but keep looking for a strong one
        // until we hit MAX_STACK_WORDS.
        bestPunctuationIndex = index;
      }

      if (pauseAfter(transcript, index) >= FALLBACK_PAUSE_SECONDS) {
        // A very long pause is as good as a strong boundary
        return endExclusive;
      }
    }
  }

  return transcript.length;
}

function createSegment(
  transcript: Word[],
  startIndex: number,
  endIndex: number
): CaptionDisplaySegment {
  const words = transcript.slice(startIndex, endIndex);

  return {
    startIndex,
    endIndex,
    start: words[0].start,
    end: words[words.length - 1].end,
    text: joinWords(words),
    words,
  };
}
