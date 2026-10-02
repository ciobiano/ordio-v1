/**
 * Which parts of an Episode actually have a Transcript.
 *
 * Chunks are transcribed several at a time, so when one fails the uploads
 * already in flight still finish. A partial Transcript is then a run from the
 * start plus islands further on, with holes between them. A Clip over a hole
 * would play audio with no Captions, so candidates are kept to the spans that
 * were transcribed. On a full run there is one span, the whole Episode, and
 * none of this changes anything.
 */

export interface Span {
  start: number;
  end: number;
}

/** Chunk seams meet exactly; this only absorbs float drift. */
const SEAM_TOLERANCE_SEC = 0.5;

export function transcribedSpans(chunks: Array<{ startSec: number; durationSec: number }>): Span[] {
  const sorted = [...chunks].sort((a, b) => a.startSec - b.startSec);
  const spans: Span[] = [];
  for (const { startSec, durationSec } of sorted) {
    const last = spans.at(-1);
    const end = startSec + durationSec;
    if (last && startSec <= last.end + SEAM_TOLERANCE_SEC) {
      spans[spans.length - 1] = { start: last.start, end: Math.max(last.end, end) };
    } else {
      spans.push({ start: startSec, end });
    }
  }
  return spans;
}

export function insideSpans(window: Span, spans: Span[]): boolean {
  return spans.some(
    (s) => window.start >= s.start - SEAM_TOLERANCE_SEC && window.end <= s.end + SEAM_TOLERANCE_SEC
  );
}

/**
 * Per-second energy with untranscribed seconds zeroed, so the energy fallback
 * looks for loud moments only where there are words to caption.
 */
export function maskToSpans(energy: number[], spans: Span[]): number[] {
  return energy.map((e, sec) => (spans.some((s) => sec + 0.5 >= s.start && sec + 0.5 <= s.end) ? e : 0));
}
