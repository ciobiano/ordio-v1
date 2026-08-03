import { describe, it, expect } from 'vitest';
import { shouldCloseOnGrabStripClick } from '@/components/soul/states/ExportState/grabStripIntent';

// The sheet's grab strip is both a drag handle and a tap-to-close button. Once
// the sheet started tracking the thumb 1:1 those two roles began to collide,
// because the strip moves with the pointer and so is still under it on release.

describe('shouldCloseOnGrabStripClick', () => {
  it('closes on a plain tap', () => {
    expect(shouldCloseOnGrabStripClick({ detail: 1, didDrag: false })).toBe(true);
  });

  it('does not close on the click that trails a drag', () => {
    // The regression: drag down short of the dismiss threshold, let go, and the
    // sheet springs back — then this click closed it anyway.
    expect(shouldCloseOnGrabStripClick({ detail: 1, didDrag: true })).toBe(false);
  });

  it('closes on keyboard activation', () => {
    // Enter/Space on a <button> synthesises a click with detail 0.
    expect(shouldCloseOnGrabStripClick({ detail: 0, didDrag: false })).toBe(true);
  });

  it('closes on keyboard activation even when the drag flag is stale', () => {
    // Some browsers suppress the post-drag click entirely, so nothing consumes
    // the flag. Reading the event origin first means that staleness can never
    // strand the only keyboard route to closing the panel.
    expect(shouldCloseOnGrabStripClick({ detail: 0, didDrag: true })).toBe(true);
  });

  it('treats a double-click as pointer-driven', () => {
    expect(shouldCloseOnGrabStripClick({ detail: 2, didDrag: false })).toBe(true);
    expect(shouldCloseOnGrabStripClick({ detail: 2, didDrag: true })).toBe(false);
  });
});
