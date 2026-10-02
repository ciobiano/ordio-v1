import { describe, it, expect } from 'vitest';
import type { Word } from '@Ordio/shared/schemas';
import { sentenceRanges } from '@/lib/clips/sentenceRanges';
import { snapCandidates } from '@/lib/clips/snapCandidates';
import { windowTranscript } from '@/lib/clips/windowTranscript';

/**
 * Build a Transcript from sentences spoken back to back: each word lasts
 * 0.3s with 0.1s between words, and each sentence is followed by `gap`.
 */
function speak(sentences: string[], { from = 0, gap = 0.3 } = {}): Word[] {
  const words: Word[] = [];
  let t = from;
  for (const sentence of sentences) {
    for (const text of sentence.split(' ')) {
      words.push({ text, start: t, end: t + 0.3 });
      t += 0.4;
    }
    t += gap;
  }
  return words;
}

const candidate = (start: number, end: number) => ({ start, end, hookText: 'h', rationale: 'r' });

/** Ten-word sentences, 4.3s each including the gap after. */
const SENTENCE = (n: number) => `Sentence ${n} has exactly ten words in it for this test.`
  .split(' ')
  .slice(0, 10)
  .join(' ')
  .replace(/\.?$/, '.');

const episode = speak(Array.from({ length: 40 }, (_, i) => SENTENCE(i)));

describe('sentenceRanges', () => {
  it('ends a sentence at terminal punctuation', () => {
    const words = speak(['One two three.', 'Four five?']);
    expect(sentenceRanges(words)).toEqual([
      { first: 0, last: 2 },
      { first: 3, last: 4 },
    ]);
  });

  it('ends a sentence at a long pause even without punctuation', () => {
    const words = speak(['one two', 'three four'], { gap: 1 });
    expect(sentenceRanges(words)).toEqual([
      { first: 0, last: 1 },
      { first: 2, last: 3 },
    ]);
  });

  it('force-breaks run-ons only when asked', () => {
    const words = speak(['a b c d e f g']);
    expect(sentenceRanges(words)).toHaveLength(1);
    expect(sentenceRanges(words, 3)).toEqual([
      { first: 0, last: 2 },
      { first: 3, last: 5 },
      { first: 6, last: 6 },
    ]);
  });
});

describe('snapCandidates', () => {
  it('moves a mid-sentence start back to where the sentence begins', () => {
    // Sentence 5 begins at 5 × 4.3 = 21.5s; the model aimed at 23s.
    const [snapped] = snapCandidates([candidate(23, 68)], episode, 200);
    expect(snapped!.start).toBeCloseTo(21.5 - 0.15, 5);
  });

  it('ends on the end of a sentence, letting the last word ring out', () => {
    const [snapped] = snapCandidates([candidate(21.5, 65)], episode, 200);
    const last = episode.find((w) => Math.abs(w.end + 0.4 - snapped!.end) < 1e-9);
    expect(last?.text.endsWith('.')).toBe(true);
  });

  it('keeps every snapped Clip a legal length', () => {
    for (const start of [0, 13, 40, 77, 101]) {
      const [snapped] = snapCandidates([candidate(start, start + 45)], episode, 200);
      const len = snapped!.end - snapped!.start;
      expect(len).toBeGreaterThanOrEqual(30);
      expect(len).toBeLessThanOrEqual(60);
    }
  });

  it('never cuts the first or last word in half', () => {
    const [snapped] = snapCandidates([candidate(23, 68)], episode, 200);
    const inside = windowTranscript(episode, snapped!.start, snapped!.end);
    expect(inside[0]!.text).toBe('Sentence');
    expect(inside.at(-1)!.text.endsWith('.')).toBe(true);
  });

  it('trims filler off the front of a Clip', () => {
    const words = speak(['So um yeah the money was gone.', ...Array.from({ length: 12 }, (_, i) => SENTENCE(i))]);
    const [snapped] = snapCandidates([candidate(0, 40)], words, 100);
    expect(windowTranscript(words, snapped!.start, snapped!.end)[0]!.text).toBe('the');
  });

  it('does not trim a sentence that is nothing but filler down to nothing', () => {
    const words = speak(['Yeah.', ...Array.from({ length: 12 }, (_, i) => SENTENCE(i))]);
    const [snapped] = snapCandidates([candidate(0, 40)], words, 100);
    expect(windowTranscript(words, snapped!.start, snapped!.end)[0]!.text).toBe('Yeah.');
  });

  it('leaves a candidate alone when there is no speech within reach', () => {
    const words = speak(Array.from({ length: 12 }, (_, i) => SENTENCE(i)), { from: 300 });
    const c = candidate(100, 145);
    expect(snapCandidates([c], words, 400)).toEqual([c]);
  });

  it('is a no-op on an empty Transcript', () => {
    const c = candidate(10, 55);
    expect(snapCandidates([c], [], 100)).toEqual([c]);
  });
});
