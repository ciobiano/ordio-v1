import type { Word } from '@Ordio/shared/schemas';
import type { CaptionDisplaySegment } from './types';
import {
  hasStrongPunctuation,
  joinWords,
  pauseAfter,
} from './textBoundaries';

const MAX_SENTENCE_WORDS = 34;
const MAX_SENTENCE_CHARS = 150;
const MAX_SENTENCE_DURATION = 8;
const MIN_SENTENCE_WORDS = 3;
const FALLBACK_SENTENCE_PAUSE_SECONDS = 0.65;

export function buildSentenceSegments(transcript: Word[]): CaptionDisplaySegment[] {
  const segments: CaptionDisplaySegment[] = [];
  let startIndex = 0;

  while (startIndex < transcript.length) {
    const endIndex = findSentenceEndIndex(transcript, startIndex);
    segments.push(createSegment(transcript, startIndex, endIndex));
    startIndex = endIndex;
  }

  return segments;
}

function findSentenceEndIndex(transcript: Word[], startIndex: number): number {
  for (let index = startIndex; index < transcript.length; index++) {
    const endExclusive = index + 1;
    const sentenceWords = transcript.slice(startIndex, endExclusive);
    const wordCount = sentenceWords.length;
    const textLength = joinWords(sentenceWords).length;
    const duration = transcript[index].end - transcript[startIndex].start;

    if (wordCount >= MIN_SENTENCE_WORDS) {
      if (hasStrongPunctuation(transcript[index])) return endExclusive;
      if (pauseAfter(transcript, index) >= FALLBACK_SENTENCE_PAUSE_SECONDS) {
        return endExclusive;
      }
    }

    if (
      wordCount >= MAX_SENTENCE_WORDS ||
      textLength >= MAX_SENTENCE_CHARS ||
      duration >= MAX_SENTENCE_DURATION
    ) {
      return endExclusive;
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
