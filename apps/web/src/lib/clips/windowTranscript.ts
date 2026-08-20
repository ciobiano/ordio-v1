import type { Word } from '@Ordio/shared/schemas';

/**
 * The Words inside [start, end], re-based to clip-relative time.
 *
 * Lives beside `validateCandidates` and `fallbackWindows` rather than inside a
 * component, which is where it was: a pure function with a test of its own,
 * reachable only by importing a mobile sheet. The desktop clip picker needs
 * the same arithmetic, and two copies of a re-basing rule is how a clip's
 * captions end up offset from its audio on one viewport and not the other.
 *
 * The filter is deliberately inclusive at both ends — a Word straddling the
 * boundary is dropped rather than clipped, because half a word rendered at a
 * guessed duration reads as a transcription error.
 */
export function windowTranscript(words: Word[], start: number, end: number): Word[] {
  return words
    .filter((w) => w.start >= start && w.end <= end)
    .map((w) => ({ text: w.text, start: w.start - start, end: w.end - start }));
}
