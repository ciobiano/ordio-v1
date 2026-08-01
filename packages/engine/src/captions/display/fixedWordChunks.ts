import type { Word } from '@Ordio/shared/schemas';
import type { CaptionDisplaySegment } from './types';
import { joinWords } from './textBoundaries';

/**
 * Slices the transcript into fixed-size word chunks — the grouping the
 * caption-presets design study uses:
 *
 *   for (let i = 0; i < words.length; i += chunkSize)
 *     chunks.push(words.slice(i, i + chunkSize));
 *
 * Deliberately blunt, and that is the point. Sentence segmentation is
 * content-aware but unbounded (up to 34 words), so a long spoken sentence
 * fills the frame and the composition stops looking like the design at all.
 * A fixed count keeps every chunk the same visual weight, which is what makes
 * the hard cut between them read as rhythm rather than as reflow.
 *
 * Timing comes from the real transcript rather than the study's synthetic
 * per-word durations — the chunk simply spans its first word's start to its
 * last word's end.
 */
export function buildFixedWordChunks(transcript: Word[], chunkSize: number): CaptionDisplaySegment[] {
  const size = Math.max(1, Math.floor(chunkSize));
  const segments: CaptionDisplaySegment[] = [];

  for (let startIndex = 0; startIndex < transcript.length; startIndex += size) {
    const endIndex = Math.min(startIndex + size, transcript.length);
    const words = transcript.slice(startIndex, endIndex);

    segments.push({
      startIndex,
      endIndex,
      start: words[0].start,
      end: words[words.length - 1].end,
      text: joinWords(words),
      words,
    });
  }

  return segments;
}
