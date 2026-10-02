import type { Word } from '@Ordio/shared/schemas';

/**
 * A silence this long ends a sentence even without punctuation. Whisper's
 * word timestamps carry no punctuation of their own — `/api/transcribe` copies
 * it back from segment text, and that alignment occasionally misses — so a
 * pause is the fallback signal that someone finished a thought.
 */
export const SENTENCE_PAUSE_SEC = 0.7;

const TERMINAL = /[.?!…]["'”’)\]]*$/;

/** Inclusive word indices of one sentence. */
export interface SentenceRange {
  first: number;
  last: number;
}

/**
 * Split a Transcript into sentences: a sentence ends at terminal punctuation
 * or at a pause of at least SENTENCE_PAUSE_SEC.
 *
 * `maxWords` force-breaks run-ons. The find-clips prompt uses it so no line
 * hides a long stretch of time behind a single timestamp; Clip snapping leaves
 * it unset, because a forced break is not a place a listener hears an ending.
 */
export function sentenceRanges(words: Word[], maxWords = Infinity): SentenceRange[] {
  const out: SentenceRange[] = [];
  let first = 0;
  for (let i = 0; i < words.length; i++) {
    const next = words[i + 1];
    const ends =
      next === undefined ||
      TERMINAL.test(words[i]!.text) ||
      next.start - words[i]!.end >= SENTENCE_PAUSE_SEC ||
      i - first + 1 >= maxWords;
    if (ends) {
      out.push({ first, last: i });
      first = i + 1;
    }
  }
  return out;
}
