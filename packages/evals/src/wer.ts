/**
 * Word Error Rate.
 *
 * WER is edit distance at the word level: the minimum number of insertions,
 * deletions and substitutions needed to turn the model's transcript into the
 * reference, divided by the reference's word count.
 *
 *     WER = (S + D + I) / N
 *
 * 0.06 means six words wrong for every hundred spoken — usually reported as
 * "94% accurate". It can exceed 1.0, because a model that hallucinates can
 * insert more words than the reference contains.
 *
 * Note what WER does *not* measure: word timings. Ordio's captions depend on
 * per-word timestamps being right, and a transcript can score a perfect 0.0
 * while every word is offset by 400ms. That is a separate eval and is not
 * attempted here — worth stating plainly in the case study rather than
 * implying this number covers it.
 */

/** What it took to turn the hypothesis into the reference. */
export interface WerResult {
  /** (S + D + I) / N. */
  wer: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  /** Words in the reference — the denominator. */
  referenceWords: number;
}

/**
 * Levenshtein over words, tracking which operation each edit was.
 *
 * Two rows rather than a full matrix: the distance only ever depends on the
 * previous row, and a full matrix on a 3,000-word chapter is 9M cells for no
 * benefit. The counts ride along in the same table so a second backtracking
 * pass is unnecessary.
 */
function align(reference: string[], hypothesis: string[]): Omit<WerResult, 'wer'> {
  interface Cell {
    cost: number;
    sub: number;
    del: number;
    ins: number;
  }

  const start = (): Cell => ({ cost: 0, sub: 0, del: 0, ins: 0 });

  let previous: Cell[] = Array.from({ length: hypothesis.length + 1 }, (_, j) => ({
    cost: j,
    sub: 0,
    del: 0,
    ins: j,
  }));

  for (let i = 1; i <= reference.length; i++) {
    const current: Cell[] = [{ cost: i, sub: 0, del: i, ins: 0 }];

    for (let j = 1; j <= hypothesis.length; j++) {
      const matched = reference[i - 1] === hypothesis[j - 1];

      const substitute: Cell = {
        cost: previous[j - 1].cost + (matched ? 0 : 1),
        sub: previous[j - 1].sub + (matched ? 0 : 1),
        del: previous[j - 1].del,
        ins: previous[j - 1].ins,
      };
      const deleteWord: Cell = {
        cost: previous[j].cost + 1,
        sub: previous[j].sub,
        del: previous[j].del + 1,
        ins: previous[j].ins,
      };
      const insertWord: Cell = {
        cost: current[j - 1].cost + 1,
        sub: current[j - 1].sub,
        del: current[j - 1].del,
        ins: current[j - 1].ins + 1,
      };

      // Ties go to substitution, then deletion. The total cost is identical
      // either way; this only decides how the errors are attributed, and
      // preferring substitution keeps the breakdown closer to how a human
      // would describe the mistake.
      let best = substitute;
      if (deleteWord.cost < best.cost) best = deleteWord;
      if (insertWord.cost < best.cost) best = insertWord;

      current[j] = best;
    }

    previous = current;
  }

  const final = previous[hypothesis.length] ?? start();
  return {
    substitutions: final.sub,
    deletions: final.del,
    insertions: final.ins,
    referenceWords: reference.length,
  };
}

/**
 * Score a transcript against its reference.
 *
 * Both sides go through `normalise` first, so the number reported depends on
 * those rules as much as on the model. Say which rules you used whenever you
 * publish a WER figure — an unstated normalisation makes the number
 * incomparable to anyone else's.
 */
export function wordErrorRate(reference: string, hypothesis: string): WerResult {
  const ref = normalise(reference);
  const hyp = normalise(hypothesis);

  if (ref.length === 0) {
    // Nothing to be wrong about, unless the model invented words.
    return {
      wer: hyp.length === 0 ? 0 : 1,
      substitutions: 0,
      deletions: 0,
      insertions: hyp.length,
      referenceWords: 0,
    };
  }

  const counts = align(ref, hyp);
  const errors = counts.substitutions + counts.deletions + counts.insertions;

  return { ...counts, wer: errors / counts.referenceWords };
}

/** Accuracy as a percentage, floored at 0 — WER above 1.0 is possible. */
export function accuracyPercent(wer: number): number {
  return Math.max(0, (1 - wer) * 100);
}

/**
 * Reduce a transcript to the tokens WER should compare.
 *
 * The rules, which must be quoted alongside any WER figure this produces:
 *
 *   1. **Lowercased.** Capitalisation is a formatting choice Whisper makes,
 *      not something it mis-heard.
 *   2. **Punctuation stripped, apostrophes kept.** Whisper's word-level output
 *      carries no punctuation at all, so scoring it would penalise the model
 *      for something it was never asked to produce.
 *   3. **Contractions left alone.** "do not" against "don't" scores as two
 *      errors — a substitution *and* a deletion, because a three-word span has
 *      to reconcile with a two-word one.
 *   4. **Numerals left alone.** "five" against "5" scores as a substitution.
 *
 * Rules 3 and 4 make these figures **pessimistic**: most published LibriSpeech
 * results expand both before scoring, so ours read worse than theirs for
 * identical audio. That is the intended direction — a lower bound is safe to
 * publish, a flattering one is not — but it makes direct comparison to other
 * people's numbers invalid unless the difference is stated.
 */
export function normalise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, '')
    .split(/\s+/)
    .filter(Boolean);
}
