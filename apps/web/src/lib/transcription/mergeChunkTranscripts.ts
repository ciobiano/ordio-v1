import type { Word } from '@Ordio/shared/schemas';

/**
 * Merge per-chunk Whisper transcripts into one episode-absolute word list.
 * Each chunk's words are offset by the chunk's start; monotonicity is
 * enforced across chunk seams (a word can never start before the previous
 * word's start — Whisper occasionally emits tiny overlaps at boundaries).
 */
export function mergeChunkTranscripts(
  chunks: Array<{ startSec: number; words: Word[] }>
): Word[] {
  const sorted = [...chunks].sort((a, b) => a.startSec - b.startSec);
  const out: Word[] = [];
  let lastStart = -Infinity;
  for (const chunk of sorted) {
    for (const w of chunk.words) {
      const start = Math.max(w.start + chunk.startSec, lastStart);
      const end = Math.max(w.end + chunk.startSec, start);
      out.push({ text: w.text, start, end });
      lastStart = start;
    }
  }
  return out;
}
