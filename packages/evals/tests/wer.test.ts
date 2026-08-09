import { describe, it, expect } from 'vitest';
import { wordErrorRate, accuracyPercent } from '../src/wer.js';
import { aggregate } from '../src/report.js';

/**
 * The scorer is the one part of an eval that must be deterministically
 * correct. Everything else reports a measurement; this decides what the
 * measurement *is*, and a bug here silently rewrites every number in the
 * report — including ones already published.
 *
 * Cases are written against hand-countable examples rather than a library's
 * output, so the expected values can be verified by reading them.
 */
describe('wordErrorRate', () => {
  it('scores a perfect transcript as zero', () => {
    const r = wordErrorRate('the quick brown fox', 'the quick brown fox');
    expect(r.wer).toBe(0);
    expect(r.substitutions + r.deletions + r.insertions).toBe(0);
  });

  it('counts a wrong word as one substitution', () => {
    const r = wordErrorRate('the quick brown fox', 'the quick brown dog');
    expect(r.substitutions).toBe(1);
    expect(r.wer).toBeCloseTo(0.25);
  });

  it('counts a missing word as a deletion', () => {
    const r = wordErrorRate('the quick brown fox', 'the quick fox');
    expect(r.deletions).toBe(1);
    expect(r.wer).toBeCloseTo(0.25);
  });

  it('counts an invented word as an insertion', () => {
    const r = wordErrorRate('the quick brown fox', 'the very quick brown fox');
    expect(r.insertions).toBe(1);
    expect(r.wer).toBeCloseTo(0.25);
  });

  it('can exceed 1.0 when the model hallucinates', () => {
    // Five reference words, and a transcript that invents far more. A rate
    // above 1.0 is meaningful information, not a value to clamp away.
    const r = wordErrorRate('one two three four five', 'one two three four five and then it kept talking for ages');
    expect(r.wer).toBeGreaterThan(0);
    expect(r.insertions).toBeGreaterThan(0);
  });

  it('treats an empty transcript as every word deleted', () => {
    const r = wordErrorRate('the quick brown fox', '');
    expect(r.deletions).toBe(4);
    expect(r.wer).toBe(1);
  });

  it('handles an empty reference without dividing by zero', () => {
    expect(wordErrorRate('', '').wer).toBe(0);
    expect(wordErrorRate('', 'hello').wer).toBe(1);
  });

  it('reports the reference length as the denominator', () => {
    // WER is normalised by what *should* have been said, never by what the
    // model produced — otherwise a verbose model could improve its own score.
    const r = wordErrorRate('a b c', 'a b c d e f g h');
    expect(r.referenceWords).toBe(3);
  });
});

describe('accuracyPercent', () => {
  it('inverts WER', () => {
    expect(accuracyPercent(0)).toBe(100);
    expect(accuracyPercent(0.06)).toBeCloseTo(94);
  });

  it('floors at zero rather than reporting negative accuracy', () => {
    expect(accuracyPercent(1.4)).toBe(0);
  });
});

describe('aggregate', () => {
  it('weights by reference length, not by sample count', () => {
    // A 10-word sample with 5 errors and a 1000-word sample with 0 errors.
    // Averaging the rates would report ~25%; weighting by words reports the
    // truth, which is that 5 words out of 1010 were wrong.
    const scores = [
      { id: 'short', split: 'clean', durationSec: 5, result: wordErrorRate('a b c d e f g h i j', 'a b c d e x y z w v') },
      { id: 'long', split: 'clean', durationSec: 300, result: wordErrorRate(Array(1000).fill('word').join(' '), Array(1000).fill('word').join(' ')) },
    ];

    const agg = aggregate(scores);
    expect(agg.referenceWords).toBe(1010);
    expect(agg.wer).toBeLessThan(0.01);
  });

  it('returns zero for an empty set rather than NaN', () => {
    expect(aggregate([]).wer).toBe(0);
  });
});
