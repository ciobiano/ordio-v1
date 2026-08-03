import { describe, it, expect } from 'vitest';
import { coverFit, containFit, resolveContentFit } from '../src/video/frameRenderer';

/**
 * How a backdrop is fitted into the canvas. `auto` is the one with judgement in
 * it — it crops when the source and target shapes are close and letterboxes
 * when they are not, so a landscape clip in a square frame keeps its content
 * instead of losing a third of its width.
 */
describe('video/frameRenderer: content fit', () => {
  // A 16:9 source into a 1:1 frame — the divergent case.
  const WIDE = { w: 1920, h: 1080 };
  // A 4:5 source into a 1:1 frame — close enough that cropping reads as framing.
  const NEAR = { w: 1080, h: 1350 };
  const SQUARE = { w: 1080, h: 1080 };

  describe('coverFit', () => {
    it('fills the frame, overflowing on the long axis', () => {
      const rect = coverFit(WIDE.w, WIDE.h, SQUARE.w, SQUARE.h);
      expect(rect.dh).toBe(1080);
      expect(rect.dw).toBeCloseTo(1920);
      // Overflow is split evenly, so the crop is centred.
      expect(rect.dx).toBeCloseTo(-420);
      expect(rect.dy).toBe(0);
    });
  });

  describe('containFit', () => {
    it('keeps the whole source visible, letterboxed on the short axis', () => {
      const rect = containFit(WIDE.w, WIDE.h, SQUARE.w, SQUARE.h);
      expect(rect.dw).toBe(1080);
      expect(rect.dh).toBeCloseTo(607.5);
      expect(rect.dx).toBe(0);
      // Bars top and bottom, equal.
      expect(rect.dy).toBeCloseTo(236.25);
    });

    it('never overflows the frame in either axis', () => {
      const rect = containFit(NEAR.w, NEAR.h, SQUARE.w, SQUARE.h);
      expect(rect.dw).toBeLessThanOrEqual(SQUARE.w + 0.001);
      expect(rect.dh).toBeLessThanOrEqual(SQUARE.h + 0.001);
    });
  });

  describe('resolveContentFit', () => {
    it('fill always covers, however divergent the shapes', () => {
      expect(resolveContentFit('fill', WIDE.w, WIDE.h, SQUARE.w, SQUARE.h)).toEqual(
        coverFit(WIDE.w, WIDE.h, SQUARE.w, SQUARE.h)
      );
    });

    it('fit always contains, however close the shapes', () => {
      expect(resolveContentFit('fit', NEAR.w, NEAR.h, SQUARE.w, SQUARE.h)).toEqual(
        containFit(NEAR.w, NEAR.h, SQUARE.w, SQUARE.h)
      );
    });

    it('auto crops when the aspect ratios are close', () => {
      // 4:5 against 1:1 diverges by 1.25 — inside the threshold.
      expect(resolveContentFit('auto', NEAR.w, NEAR.h, SQUARE.w, SQUARE.h)).toEqual(
        coverFit(NEAR.w, NEAR.h, SQUARE.w, SQUARE.h)
      );
    });

    it('auto letterboxes when they are not', () => {
      // 16:9 against 1:1 diverges by 1.78 — past the threshold, so cropping
      // would eat a third of the frame.
      expect(resolveContentFit('auto', WIDE.w, WIDE.h, SQUARE.w, SQUARE.h)).toEqual(
        containFit(WIDE.w, WIDE.h, SQUARE.w, SQUARE.h)
      );
    });

    it('auto treats the divergence symmetrically', () => {
      // A tall source in a wide frame is the same problem mirrored.
      const portraitInWide = resolveContentFit('auto', 1080, 1920, 1920, 1080);
      expect(portraitInWide).toEqual(containFit(1080, 1920, 1920, 1080));
    });

    it('auto covers an exact match rather than doing nothing', () => {
      const rect = resolveContentFit('auto', SQUARE.w, SQUARE.h, SQUARE.w, SQUARE.h);
      expect(rect).toEqual({ dx: 0, dy: 0, dw: 1080, dh: 1080 });
    });
  });
});
