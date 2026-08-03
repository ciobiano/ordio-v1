import { describe, it, expect } from 'vitest';
import {
  layoutWrappedLines,
  AUTO_FIT_MIN_SCALE,
  AUTO_FIT_MAX_SCALE,
  type LayoutWord,
} from '../src/processing/captions/shared';

/**
 * Auto fit deliberately reverses the fixed-size rule that captionSizeStability
 * guards. That test proves size holds constant with the flag off; this one
 * proves it varies with the flag on. Both behaviours are wanted — the pair is
 * the contract.
 */

/** Uniform words, so block width is a clean function of the count. */
function line(count: number, wordWidth = 100): LayoutWord[] {
  return Array.from({ length: count }, (_, i) => ({
    text: `w${i}`,
    start: i,
    end: i + 1,
    wordWidth,
    pauseToNext: 0,
  }));
}

const SPACE = 10;
const MAX_WIDTH = 1000;

describe('processing/captions: auto fit', () => {
  describe('off (the default)', () => {
    it('holds one scale regardless of how much text there is', () => {
      const short = layoutWrappedLines(line(2), SPACE, MAX_WIDTH);
      const long = layoutWrappedLines(line(9), SPACE, MAX_WIDTH);

      expect(short.scale).toBe(1);
      expect(long.scale).toBe(1);
    });

    it('still shrinks the one case wrapping cannot fix — a single wide word', () => {
      const oversized = layoutWrappedLines(line(1, MAX_WIDTH * 2), SPACE, MAX_WIDTH);
      expect(oversized.scale).toBeLessThan(1);
    });
  });

  describe('on', () => {
    it('scales a short block up to fill the width', () => {
      // Two words span 210 of 1000, so it has room to grow.
      const { scale } = layoutWrappedLines(line(2), SPACE, MAX_WIDTH, { fitToWidth: true });
      expect(scale).toBeGreaterThan(1);
    });

    it('scales a dense block down', () => {
      const { scale } = layoutWrappedLines(line(1, MAX_WIDTH * 2), SPACE, MAX_WIDTH, {
        fitToWidth: true,
      });
      expect(scale).toBeLessThan(1);
    });

    it('gives different phrase lengths different sizes — the point of the setting', () => {
      const short = layoutWrappedLines(line(2), SPACE, MAX_WIDTH, { fitToWidth: true });
      const long = layoutWrappedLines(line(8), SPACE, MAX_WIDTH, { fitToWidth: true });
      expect(short.scale).not.toBe(long.scale);
      expect(short.scale).toBeGreaterThan(long.scale);
    });

    it('clamps both ends, so neither extreme becomes unreadable', () => {
      const tiny = layoutWrappedLines(line(1, 1), SPACE, MAX_WIDTH, { fitToWidth: true });
      const huge = layoutWrappedLines(line(1, MAX_WIDTH * 50), SPACE, MAX_WIDTH, {
        fitToWidth: true,
      });

      expect(tiny.scale).toBe(AUTO_FIT_MAX_SCALE);
      expect(huge.scale).toBe(AUTO_FIT_MIN_SCALE);
    });

    it('reports a logical width consistent with the scale it chose', () => {
      const layout = layoutWrappedLines(line(3), SPACE, MAX_WIDTH, { fitToWidth: true });
      expect(layout.logicalMaxWidth).toBeCloseTo(MAX_WIDTH / layout.scale);
    });

    it('still wraps rather than shrinking to force one line', () => {
      // Twelve 100px words cannot fit 1000px on one line at any sane scale.
      const layout = layoutWrappedLines(line(12), SPACE, MAX_WIDTH, { fitToWidth: true });
      expect(layout.lines.length).toBeGreaterThan(1);
    });
  });
});
