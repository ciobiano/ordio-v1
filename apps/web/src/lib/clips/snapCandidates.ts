import type { ClipCandidate, Word } from '@Ordio/shared/schemas';
import { sentenceRanges } from './sentenceRanges';
import { CLIP_MAX_SEC, CLIP_MIN_SEC } from './validateCandidates';

/** How far a proposed start may move to land on the start of a sentence. */
const START_REACH_SEC = 12;
/**
 * How far a proposed end may move to land on the end of a sentence. Past
 * this the end stays near where it was proposed and only snaps to a word: a
 * Clip that ends mid-thought is a smaller loss than one that stops before
 * its payoff.
 */
const END_REACH_SEC = 10;
/** Room before the first word so its onset is not clipped. */
const LEAD_IN_SEC = 0.15;
/** Room after the last word so it rings out rather than cutting dead. */
const RING_OUT_SEC = 0.4;

/**
 * Words a Clip should not open on. The first second decides whether someone
 * keeps watching, and "So, um, yeah —" spends it on nothing. Trimmed only at
 * the start, and never past the end of the sentence.
 */
const OPENING_FILLERS = new Set([
  'um', 'umm', 'uh', 'uhm', 'erm', 'er', 'ah', 'hmm', 'mm',
  'so', 'like', 'yeah', 'okay', 'ok', 'well', 'and', 'anyway',
]);

const bare = (text: string) => text.toLowerCase().replace(/[^a-z']/g, '');

function skipFillers(words: Word[], first: number, last: number): number {
  let i = first;
  while (i < last && OPENING_FILLERS.has(bare(words[i]!.text))) i++;
  return i;
}

function clipStartAt(words: Word[], i: number): number {
  const word = words[i]!;
  // Never earlier than the previous word's end — that word is not in the Clip.
  const padded = Math.max(0, words[i - 1]?.end ?? 0, word.start - LEAD_IN_SEC);
  return Math.min(word.start, padded);
}

function clipEndAt(words: Word[], j: number, durationSec: number): number {
  const word = words[j]!;
  const nextStart = words[j + 1]?.start ?? Infinity;
  return Math.min(durationSec, Math.max(word.end, Math.min(nextStart, word.end + RING_OUT_SEC)));
}

/** The allowed end nearest `target` that keeps the Clip a legal length. */
function pickEnd(
  words: Word[],
  first: number,
  start: number,
  target: number,
  durationSec: number,
  allowed: (j: number) => boolean
): number | null {
  let best: number | null = null;
  for (let j = first; j < words.length; j++) {
    const end = clipEndAt(words, j, durationSec);
    const len = end - start;
    if (len > CLIP_MAX_SEC) break;
    if (len < CLIP_MIN_SEC || !allowed(j)) continue;
    if (best === null || Math.abs(end - target) < Math.abs(best - target)) best = end;
  }
  return best;
}

/**
 * Move each Clip's edges onto speech: start at the beginning of a sentence
 * with leading filler trimmed, end where a sentence ends.
 *
 * The model proposes times from a timestamped transcript and lands near a
 * boundary rather than on one; the energy fallback knows nothing about words
 * at all. Unsnapped, a Clip opens mid-word, and `windowTranscript` drops the
 * straddling word, so the first Caption is the second half of a thought.
 *
 * A candidate that cannot be snapped within reach while staying 30–60s long
 * is returned unchanged, never dropped.
 */
export function snapCandidates(
  candidates: ClipCandidate[],
  words: Word[],
  durationSec: number
): ClipCandidate[] {
  if (words.length === 0) return candidates;
  const sentences = sentenceRanges(words);
  const sentenceEnds = new Set(sentences.map((s) => s.last));
  const sentenceStarts = sentences.map((s) => skipFillers(words, s.first, s.last));

  return candidates.map((c) => {
    const distance = (i: number) => Math.abs(words[i]!.start - c.start);
    const starts = sentenceStarts
      .filter((i) => distance(i) <= START_REACH_SEC)
      .sort((a, b) => distance(a) - distance(b));
    if (starts.length === 0) {
      const i = words.findIndex((w) => w.start >= c.start);
      if (i >= 0 && distance(i) <= START_REACH_SEC) {
        starts.push(skipFillers(words, i, words.length - 1));
      }
    }

    for (const first of starts) {
      const start = clipStartAt(words, first);
      const atSentence = pickEnd(words, first, start, c.end, durationSec, (j) => sentenceEnds.has(j));
      const end =
        atSentence !== null && Math.abs(atSentence - c.end) <= END_REACH_SEC
          ? atSentence
          : pickEnd(words, first, start, c.end, durationSec, () => true);
      if (end !== null) return { ...c, start, end };
    }
    return c;
  });
}
