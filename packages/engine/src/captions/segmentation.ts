import type { Word } from '@Ordio/shared/schemas';

export interface CaptionSegment {
  startIndex: number;
  endIndex: number;
  start: number;
  end: number;
  text: string;
}

interface SegmentOptions {
  maxWords: number;
  maxChars: number;
  maxDuration: number;
  minWords: number;
}

const DEFAULT_OPTIONS: SegmentOptions = {
  maxWords: 12,
  maxChars: 42,
  maxDuration: 2.2,
  minWords: 3,
};

const STRONG_PUNCT_RE = /[.?!;:]$/;
const SOFT_PUNCT_RE = /[,]$/;

function boundaryScore(prev: Word, next: Word): number {
  let score = 0;
  const prevText = prev.text.trim();
  const pause = Math.max(0, next.start - prev.end);

  if (STRONG_PUNCT_RE.test(prevText)) score += 4;
  else if (SOFT_PUNCT_RE.test(prevText)) score += 2;

  if (pause >= 0.35) score += 4;
  else if (pause >= 0.22) score += 2;

  return score;
}

function calcTextLength(words: Word[], start: number, endInclusive: number): number {
  let len = 0;
  for (let i = start; i <= endInclusive; i++) {
    len += words[i]?.text.length ?? 0;
    if (i > start) len += 1; // space
  }
  return len;
}

export function buildSmartSegments(
  transcript: Word[],
  options: Partial<SegmentOptions> = {}
): CaptionSegment[] {
  if (transcript.length === 0) return [];
  const cfg = { ...DEFAULT_OPTIONS, ...options };
  const out: CaptionSegment[] = [];

  let start = 0;
  while (start < transcript.length) {
    let i = start;
    let bestBreak = -1; // exclusive index
    let bestBreakScore = -1;

    while (i < transcript.length) {
      const wordCount = i - start + 1;
      const charCount = calcTextLength(transcript, start, i);
      const duration = transcript[i].end - transcript[start].start;
      const hardExceeded =
        wordCount > cfg.maxWords ||
        charCount > cfg.maxChars ||
        duration > cfg.maxDuration;

      if (i > start) {
        const breakAfterPrev = i; // break before i
        const score = boundaryScore(transcript[i - 1], transcript[i]);
        if (score > bestBreakScore) {
          bestBreakScore = score;
          bestBreak = breakAfterPrev;
        }
      }

      if (!hardExceeded) {
        i++;
        continue;
      }

      const hasEnoughWordsAtBestBreak = bestBreak > start && bestBreak - start >= cfg.minWords;
      const cut = hasEnoughWordsAtBestBreak ? bestBreak : i;
      const safeCut = Math.max(start + 1, cut);

      out.push({
        startIndex: start,
        endIndex: safeCut,
        start: transcript[start].start,
        end: transcript[safeCut - 1].end,
        text: transcript.slice(start, safeCut).map((w) => w.text).join(' '),
      });

      start = safeCut;
      break;
    }

    if (i >= transcript.length) {
      out.push({
        startIndex: start,
        endIndex: transcript.length,
        start: transcript[start].start,
        end: transcript[transcript.length - 1].end,
        text: transcript.slice(start).map((w) => w.text).join(' '),
      });
      break;
    }
  }

  return out;
}

export function findActiveSegmentIndex(segments: CaptionSegment[], currentTime: number): number {
  if (segments.length === 0) return -1;

  for (let i = 0; i < segments.length; i++) {
    if (currentTime >= segments[i].start && currentTime < segments[i].end) return i;
  }

  if (currentTime < segments[0].start) return 0;
  if (currentTime >= segments[segments.length - 1].end) return segments.length - 1;
  return -1;
}

