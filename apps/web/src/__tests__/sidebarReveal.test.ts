import { describe, it, expect } from 'vitest';
import { computeSidebarRevealPx, SIDEBAR_REVEAL_RATIO } from '@/components/soul/capture/sidebarReveal';

describe('computeSidebarRevealPx', () => {
  it('computes the reveal distance as a rounded percentage of container width', () => {
    expect(computeSidebarRevealPx(440)).toBe(326); // 440 * 0.74 = 325.6 -> 326
  });

  it('returns 0 for a zero-width container', () => {
    expect(computeSidebarRevealPx(0)).toBe(0);
  });

  it('matches SIDEBAR_REVEAL_RATIO exactly for any width', () => {
    expect(computeSidebarRevealPx(1000)).toBe(Math.round(1000 * SIDEBAR_REVEAL_RATIO));
  });
});
