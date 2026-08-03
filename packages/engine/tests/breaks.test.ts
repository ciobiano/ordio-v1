import { describe, it, expect } from 'vitest';
import { buildSegmentsForMode } from '../src/captions/breaks';
import type { Word } from '@Ordio/shared/schemas';

/** Evenly spaced words: 0.4s each, 0.1s gap. Ten of them span 4.9s. */
function words(count: number, texts?: string[]): Word[] {
  let time = 0;
  return Array.from({ length: count }, (_, i) => {
    const word = { text: texts?.[i] ?? `w${i + 1}`, start: time, end: time + 0.4 };
    time += 0.5;
    return word;
  });
}

const sizes = (segments: { startIndex: number; endIndex: number }[]) =>
  segments.map((s) => s.endIndex - s.startIndex);

describe('captions: break modes', () => {
  it('returns nothing for an empty transcript', () => {
    expect(buildSegmentsForMode([], { mode: 'punct' })).toEqual([]);
  });

  describe('single', () => {
    it('gives every word its own block', () => {
      const out = buildSegmentsForMode(words(5), { mode: 'single' });
      expect(sizes(out)).toEqual([1, 1, 1, 1, 1]);
      expect(out[2].text).toBe('w3');
    });
  });

  describe('quantity', () => {
    it('cuts at a fixed word count', () => {
      expect(sizes(buildSegmentsForMode(words(10), { mode: 'quantity', quantity: 3 }))).toEqual([
        3, 3, 3, 1,
      ]);
    });

    it('lets the last block be short rather than padding it', () => {
      const out = buildSegmentsForMode(words(7), { mode: 'quantity', quantity: 4 });
      expect(sizes(out)).toEqual([4, 3]);
    });

    it('clamps out-of-range counts instead of producing empty blocks', () => {
      expect(sizes(buildSegmentsForMode(words(6), { mode: 'quantity', quantity: 0 }))).toEqual([
        1, 1, 1, 1, 1, 1,
      ]);
      expect(sizes(buildSegmentsForMode(words(20), { mode: 'quantity', quantity: 99 }))).toEqual([
        8, 8, 4,
      ]);
    });

    it("treats quantity 'random' as the random mode", () => {
      const viaQuantity = buildSegmentsForMode(words(12), { mode: 'quantity', quantity: 'random' });
      const viaMode = buildSegmentsForMode(words(12), { mode: 'random' });
      expect(sizes(viaQuantity)).toEqual(sizes(viaMode));
    });
  });

  describe('time', () => {
    it('closes a block once it has held for the budget', () => {
      // 0.5s per word, so a 2s budget lands about four words per block.
      const out = buildSegmentsForMode(words(12), { mode: 'time', holdSeconds: 2 });
      for (const size of sizes(out).slice(0, -1)) {
        expect(size).toBeGreaterThanOrEqual(3);
        expect(size).toBeLessThanOrEqual(5);
      }
    });

    it('covers every word exactly once, with no gaps or overlaps', () => {
      const out = buildSegmentsForMode(words(11), { mode: 'time', holdSeconds: 1.5 });
      expect(out[0].startIndex).toBe(0);
      expect(out[out.length - 1].endIndex).toBe(11);
      for (let i = 1; i < out.length; i++) {
        expect(out[i].startIndex).toBe(out[i - 1].endIndex);
      }
    });

    it('still emits a word longer than the whole budget', () => {
      const long: Word[] = [{ text: 'sooooo', start: 0, end: 9 }, { text: 'yeah', start: 9, end: 9.4 }];
      const out = buildSegmentsForMode(long, { mode: 'time', holdSeconds: 1 });
      expect(out.flatMap((s) => s.text.split(' '))).toEqual(['sooooo', 'yeah']);
    });

    it('clamps a budget outside the slider range', () => {
      const out = buildSegmentsForMode(words(10), { mode: 'time', holdSeconds: 0 });
      expect(out.length).toBeGreaterThan(0);
      expect(out[out.length - 1].endIndex).toBe(10);
    });
  });

  describe('random', () => {
    it('is deterministic for the same words', () => {
      // Recomputed on every transcript rebuild — Math.random would reflow the
      // user's captions each time for no reason.
      const a = buildSegmentsForMode(words(20), { mode: 'random' });
      const b = buildSegmentsForMode(words(20), { mode: 'random' });
      expect(sizes(a)).toEqual(sizes(b));
    });

    it('varies with the words, so different speech cuts differently', () => {
      const a = buildSegmentsForMode(words(20), { mode: 'random' });
      const b = buildSegmentsForMode(
        words(20, Array.from({ length: 20 }, (_, i) => `different${i}`)),
        { mode: 'random' }
      );
      expect(sizes(a)).not.toEqual(sizes(b));
    });

    it('keeps blocks inside the readable range', () => {
      const out = buildSegmentsForMode(words(40), { mode: 'random' });
      for (const size of sizes(out).slice(0, -1)) {
        expect(size).toBeGreaterThanOrEqual(2);
        expect(size).toBeLessThanOrEqual(5);
      }
    });

    it('actually varies rather than settling on one size', () => {
      const out = buildSegmentsForMode(words(60), { mode: 'random' });
      expect(new Set(sizes(out).slice(0, -1)).size).toBeGreaterThan(1);
    });
  });

  describe('every mode', () => {
    const modes = [
      { mode: 'punct' as const },
      { mode: 'single' as const },
      { mode: 'quantity' as const, quantity: 3 },
      { mode: 'time' as const, holdSeconds: 2 },
      { mode: 'random' as const },
    ];

    it('covers the whole transcript contiguously', () => {
      for (const options of modes) {
        const out = buildSegmentsForMode(words(17), options);
        expect(out[0].startIndex, options.mode).toBe(0);
        expect(out[out.length - 1].endIndex, options.mode).toBe(17);
        for (let i = 1; i < out.length; i++) {
          expect(out[i].startIndex, options.mode).toBe(out[i - 1].endIndex);
        }
      }
    });

    it('carries timings from the words it spans', () => {
      const source = words(9);
      for (const options of modes) {
        for (const segment of buildSegmentsForMode(source, options)) {
          expect(segment.start, options.mode).toBe(source[segment.startIndex].start);
          expect(segment.end, options.mode).toBe(source[segment.endIndex - 1].end);
        }
      }
    });

    it('never emits an empty block', () => {
      for (const options of modes) {
        for (const size of sizes(buildSegmentsForMode(words(13), options))) {
          expect(size, options.mode).toBeGreaterThan(0);
        }
      }
    });
  });
});
