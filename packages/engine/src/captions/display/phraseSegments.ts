import type { Word } from '@Ordio/shared/schemas';
import type { CaptionDisplaySegment, MeasureCaptionText } from './types';
import {
  hasSoftPunctuation,
  hasStrongPunctuation,
  joinWords,
  pauseAfter,
} from './textBoundaries';

const MAX_PHRASE_WORDS = 8;
const MAX_PHRASE_CHARS = 38;
const MAX_PHRASE_DURATION = 1.9;
const MIN_NATURAL_PHRASE_WORDS = 2;
const SOFT_PAUSE_SECONDS = 0.24;
const STRONG_PAUSE_SECONDS = 0.38;

interface PhraseCandidate {
  endExclusive: number;
  score: number;
}

export function buildOneLinePhraseSegments(
  transcript: Word[],
  measureText: MeasureCaptionText,
  maxWidth: number
): CaptionDisplaySegment[] {
  const segments: CaptionDisplaySegment[] = [];
  let startIndex = 0;

  while (startIndex < transcript.length) {
    const endIndex = findPhraseEndIndex(transcript, startIndex, measureText, maxWidth);
    segments.push(createSegment(transcript, startIndex, endIndex));
    startIndex = endIndex;
  }

  return segments;
}

function findPhraseEndIndex(
  transcript: Word[],
  startIndex: number,
  measureText: MeasureCaptionText,
  maxWidth: number
): number {
  let bestNaturalBreak: PhraseCandidate | null = null;
  let lastFittingEnd = startIndex + 1;

  for (let index = startIndex; index < transcript.length; index++) {
    const endExclusive = index + 1;
    const phraseWords = transcript.slice(startIndex, endExclusive);
    const text = joinWords(phraseWords);
    const wordCount = phraseWords.length;
    const duration = transcript[index].end - transcript[startIndex].start;
    const fitsOneLine = measureText(text) <= maxWidth;

    if (fitsOneLine) {
      lastFittingEnd = endExclusive;
      const naturalScore = scoreNaturalBreak(transcript, index, wordCount);
      if (naturalScore > 0) {
        bestNaturalBreak = { endExclusive, score: naturalScore };
      }
    }

    const exceedsReadableLimit =
      !fitsOneLine ||
      wordCount > MAX_PHRASE_WORDS ||
      text.length > MAX_PHRASE_CHARS ||
      duration > MAX_PHRASE_DURATION;

    if (exceedsReadableLimit) {
      return chooseReadablePhraseEnd(startIndex, lastFittingEnd, bestNaturalBreak);
    }

    if (bestNaturalBreak && bestNaturalBreak.score >= 4) {
      return bestNaturalBreak.endExclusive;
    }
  }

  return transcript.length;
}

function scoreNaturalBreak(transcript: Word[], index: number, wordCount: number): number {
  if (wordCount < MIN_NATURAL_PHRASE_WORDS) return 0;

  const word = transcript[index];
  const pause = pauseAfter(transcript, index);

  if (hasStrongPunctuation(word)) return 5;
  if (pause >= STRONG_PAUSE_SECONDS) return 4;
  if (hasSoftPunctuation(word)) return 3;
  if (pause >= SOFT_PAUSE_SECONDS) return 2;
  return 0;
}

function chooseReadablePhraseEnd(
  startIndex: number,
  lastFittingEnd: number,
  bestNaturalBreak: PhraseCandidate | null
): number {
  if (bestNaturalBreak && bestNaturalBreak.endExclusive > startIndex) {
    return bestNaturalBreak.endExclusive;
  }

  return Math.max(startIndex + 1, lastFittingEnd);
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
