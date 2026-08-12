import { describe, it, expect } from 'vitest';
import { normalise, wordErrorRate } from '../src/wer.js';

/**
 * Normalisation decides what counts as an error, so these tests exist to stop
 * the rules drifting silently. A change here rewrites every number the harness
 * has ever reported — including ones already published — so a failure means
 * "the published figures are now wrong", not "fix the test".
 */
describe('normalise', () => {
  it('lowercases, because capitalisation is formatting rather than hearing', () => {
    expect(normalise('Hello World')).toEqual(['hello', 'world']);
  });

  it('strips punctuation, which Whisper never emits at word level anyway', () => {
    expect(normalise('Hello, world! Yes — really.')).toEqual(['hello', 'world', 'yes', 'really']);
  });

  it('keeps apostrophes, so contractions stay whole tokens', () => {
    expect(normalise("it's o'clock")).toEqual(["it's", "o'clock"]);
  });

  it('collapses runs of whitespace and drops empties', () => {
    expect(normalise('  a   b \n c  ')).toEqual(['a', 'b', 'c']);
  });

  it('leaves numerals as digits', () => {
    expect(normalise('5 items')).toEqual(['5', 'items']);
  });
});

describe('the cost of the chosen rules', () => {
  it('makes punctuation and case free', () => {
    // This is the whole reason normalisation exists — without it, a comma and
    // a capital letter scored as two substitutions out of two words.
    expect(wordErrorRate('Hello, world!', 'hello world').wer).toBe(0);
  });

  it('charges two errors for an unexpanded contraction', () => {
    // Documented deliberately: a three-word reference reconciling with a
    // two-word hypothesis costs a substitution *and* a deletion. This is what
    // makes our figures pessimistic against published LibriSpeech results.
    const r = wordErrorRate('do not go', "don't go");
    expect(r.substitutions).toBe(1);
    expect(r.deletions).toBe(1);
  });

  it('charges one substitution for a numeral against a spelled number', () => {
    expect(wordErrorRate('five items', '5 items').substitutions).toBe(1);
  });
});
